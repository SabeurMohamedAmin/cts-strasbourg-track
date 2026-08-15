import 'dotenv/config'

/**
 * GTFS static feed importer
 * Usage: pnpm gtfs:import [path/to/gtfs.zip-or-directory]
 *
 * Downloads from transport.data.gouv.fr if no path provided.
 * Parses CSV files and bulk-inserts into PostgreSQL via Drizzle ORM.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import AdmZip from 'adm-zip'
import { parse } from 'csv-parse/sync'
import { Pool } from 'pg'
import { resolveSsl } from '../server/database/ssl'

// ---- Config ----------------------------------------------------------------

const DEFAULT_ZIP_PATH = resolve('./data/gtfs/cts-gtfs.zip')
const BATCH_SIZE = 500

// ---- DB --------------------------------------------------------------------

const databaseUrl = process.env.NUXT_DATABASE_URL

if (!databaseUrl) {
  throw new Error('Missing NUXT_DATABASE_URL. Add it to .env before importing GTFS.')
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: resolveSsl(),
})

// ---- Helpers ---------------------------------------------------------------

function parseCsv(content: string): Record<string, string>[] {
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  })
}

async function batchInsert(
  tableName: string,
  rows: object[],
  batchSize = BATCH_SIZE,
): Promise<void> {
  if (!rows.length) return
  let inserted = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize)
    const columns = Object.keys(chunk[0]!)
    // One placeholder per value: ($1, $2, ...), ($9, $10, ...), ...
    const placeholders = chunk.map(
      (_, rowIndex) => `(${columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`).join(', ')})`
    ).join(', ')
    const values = chunk.flatMap(row => columns.map(column => (row as Record<string, unknown>)[column] ?? null))
    // pg binds the values server-side — safe against injection and type-correct.
    await pool.query(
      `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
      values,
    )
    inserted += chunk.length
  }
  console.log(`  ✓ ${tableName}: ${inserted} rows`)
}

// ---- Import ----------------------------------------------------------------

async function importGtfs(sourcePath: string) {
  const sourceIsDirectory = statSync(sourcePath).isDirectory()
  console.log(`\n📦 Reading GTFS ${sourceIsDirectory ? 'directory' : 'zip'}: ${sourcePath}`)
  const zip = sourceIsDirectory ? null : new AdmZip(sourcePath)

  function readFile(name: string): string | null {
    if (sourceIsDirectory) {
      const filePath = join(sourcePath, name)
      if (!existsSync(filePath)) {
        console.warn(`  ⚠️  ${name} not found — skipping`)
        return null
      }
      return readFileSync(filePath, 'utf8')
    }

    // GTFS publishers commonly package files in a single top-level directory.
    const entry = zip!.getEntry(name) ?? zip!.getEntries().find(candidate =>
      candidate.entryName.replace(/\\/g, '/').endsWith(`/${name}`),
    )
    if (!entry || entry.isDirectory) {
      console.warn(`  ⚠️  ${name} not found in zip — skipping`)
      return null
    }
    return entry.getData().toString('utf8')
  }

  const requiredFiles = ['routes.txt', 'stops.txt', 'trips.txt', 'stop_times.txt']
  const missingFiles = requiredFiles.filter(file => !readFile(file))
  if (missingFiles.length) {
    throw new Error(`Invalid GTFS source: missing required files: ${missingFiles.join(', ')}`)
  }

  // 1. Routes
  const routesCsv = readFile('routes.txt')
  if (routesCsv) {
    const rows = parseCsv(routesCsv).map(r => ({
      route_id:         r.route_id,
      agency_id:        r.agency_id ?? null,
      route_short_name: r.route_short_name,
      route_long_name:  r.route_long_name ?? null,
      route_type:       parseInt(r.route_type, 10),
      route_color:      r.route_color ?? null,
      route_text_color: r.route_text_color ?? null,
      route_desc:       r.route_desc ?? null,
    }))
    await batchInsert('routes', rows)
  }

  // 2. Stops
  // stop_code (e.g. "704A") is the identifier the CTS SIRI real-time API
  // uses (MonitoringRef / StopPointRef) — it MUST be imported alongside
  // stop_id for the real-time features to work.
  const stopsCsv = readFile('stops.txt')
  if (stopsCsv) {
    const rows = parseCsv(stopsCsv).map(s => ({
      stop_id:              s.stop_id,
      stop_code:            s.stop_code ?? null,
      stop_name:            s.stop_name,
      stop_lat:             parseFloat(s.stop_lat),
      stop_lon:             parseFloat(s.stop_lon),
      location_type:        s.location_type ? parseInt(s.location_type, 10) : 0,
      parent_station:       s.parent_station ?? null,
      wheelchair_boarding:  s.wheelchair_boarding ? parseInt(s.wheelchair_boarding, 10) : 0,
      platform_code:        s.platform_code ?? null,
    }))
    await batchInsert('stops', rows)

    // Backfill stop_code on rows that already existed: batchInsert uses
    // ON CONFLICT DO NOTHING, so previously imported stops are skipped.
    // Single set-based UPDATE — no per-row round trips.
    await pool.query(
      `UPDATE stops SET stop_code = data.code
       FROM (SELECT unnest($1::text[]) AS id, unnest($2::text[]) AS code) AS data
       WHERE stops.stop_id = data.id
         AND stops.stop_code IS DISTINCT FROM data.code`,
      [rows.map(r => r.stop_id), rows.map(r => r.stop_code)],
    )
    console.log('  ✓ stops: stop_code backfilled')
  }

  // 3. Shapes
  const shapesCsv = readFile('shapes.txt')
  if (shapesCsv) {
    const rows = parseCsv(shapesCsv).map(s => ({
      id:                   `${s.shape_id}_${s.shape_pt_sequence}`,
      shape_id:             s.shape_id,
      shape_pt_lat:         parseFloat(s.shape_pt_lat),
      shape_pt_lon:         parseFloat(s.shape_pt_lon),
      shape_pt_sequence:    parseInt(s.shape_pt_sequence, 10),
      shape_dist_traveled:  s.shape_dist_traveled ? parseFloat(s.shape_dist_traveled) : null,
    }))
    await batchInsert('shapes', rows)
  }

  // 4. Trips
  const tripsCsv = readFile('trips.txt')
  if (tripsCsv) {
    const rows = parseCsv(tripsCsv).map(t => ({
      trip_id:               t.trip_id,
      route_id:              t.route_id,
      service_id:            t.service_id,
      shape_id:              t.shape_id ?? null,
      trip_headsign:         t.trip_headsign ?? null,
      direction_id:          t.direction_id ? parseInt(t.direction_id, 10) : null,
      block_id:              t.block_id ?? null,
      wheelchair_accessible: t.wheelchair_accessible ? parseInt(t.wheelchair_accessible, 10) : 0,
    }))
    await batchInsert('trips', rows)
  }

  // 5. Stop times
  const stCsv = readFile('stop_times.txt')
  if (stCsv) {
    const rows = parseCsv(stCsv).map(st => ({
      id:                   `${st.trip_id}_${st.stop_sequence}`,
      trip_id:              st.trip_id,
      arrival_time:         st.arrival_time,
      departure_time:       st.departure_time,
      stop_id:              st.stop_id,
      stop_sequence:        parseInt(st.stop_sequence, 10),
      stop_headsign:        st.stop_headsign ?? null,
      pickup_type:          st.pickup_type ? parseInt(st.pickup_type, 10) : 0,
      drop_off_type:        st.drop_off_type ? parseInt(st.drop_off_type, 10) : 0,
      shape_dist_traveled:  st.shape_dist_traveled ?? null,
      timepoint:            st.timepoint !== '0',
    }))
    await batchInsert('stop_times', rows)
  }

  // 6. Calendar
  const calCsv = readFile('calendar.txt')
  if (calCsv) {
    const rows = parseCsv(calCsv).map(c => ({
      service_id: c.service_id,
      monday:     c.monday === '1',
      tuesday:    c.tuesday === '1',
      wednesday:  c.wednesday === '1',
      thursday:   c.thursday === '1',
      friday:     c.friday === '1',
      saturday:   c.saturday === '1',
      sunday:     c.sunday === '1',
      start_date: c.start_date,
      end_date:   c.end_date,
    }))
    await batchInsert('calendar', rows)
  }

  // 7. Calendar dates
  const cdCsv = readFile('calendar_dates.txt')
  if (cdCsv) {
    const rows = parseCsv(cdCsv).map(cd => ({
      id:             `${cd.service_id}_${cd.date}`,
      service_id:     cd.service_id,
      date:           cd.date,
      exception_type: parseInt(cd.exception_type, 10),
    }))
    await batchInsert('calendar_dates', rows)
  }

  console.log('\n✅ GTFS import complete!')
  await pool.end()
}

// ---- Entry point -----------------------------------------------------------

const zipPath = process.argv[2] ?? DEFAULT_ZIP_PATH

if (!existsSync(zipPath)) {
  console.error(`❌ GTFS source not found at: ${zipPath}`)
  console.error('Provide either an extracted GTFS directory or a GTFS ZIP archive.')
  console.error('Example: pnpm gtfs:import "./Données théoriques (GTFS)"')
  process.exit(1)
}

importGtfs(zipPath).catch((err) => {
  console.error('Import failed:', err)
  process.exit(1)
})
