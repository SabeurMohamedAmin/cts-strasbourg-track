import 'dotenv/config'

/**
 * Migration runner — usage: pnpm db:migrate [--dry-run]
 *
 * Why this exists instead of `drizzle-kit migrate`:
 *
 * 1. drizzle-kit exits with code 1 without printing the driver error, so a
 *    failing migration is impossible to diagnose.
 * 2. This database was created before drizzle's bookkeeping table existed
 *    (schema pushed directly, or restored elsewhere). The migrator then
 *    starts again at 0000 and fails on the first already-existing object —
 *    and re-running history would be DESTRUCTIVE, because 0002 and 0003
 *    contain DROP TABLE ... CASCADE and DROP COLUMN statements.
 *
 * So we BASELINE first: for each migration, in order, check whether the
 * object it introduces is already there. If it is, record it as applied
 * WITHOUT executing it. Stop at the first migration that is genuinely
 * missing and let the drizzle migrator apply the remainder normally.
 *
 * Nothing here writes or deletes application data.
 *
 * Uses the same bootstrap as scripts/import-gtfs.ts: dotenv + resolveSsl(),
 * so it connects exactly like the server does.
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { resolveSsl } from '../server/database/ssl'

const MIGRATIONS_FOLDER = './server/database/migrations'
const DRY_RUN = process.argv.includes('--dry-run')

/** How to tell that a migration has already been applied. */
type Marker =
  | { kind: 'table', table: string }
  | { kind: 'column', table: string, column: string }
  | { kind: 'index', index: string }
  /** Data-only migration: idempotent, so always let the migrator run it. */
  | { kind: 'run' }

/**
 * One entry per migration file. Keep this in sync when adding a migration:
 * name the object the file creates, or 'run' for a pure data statement.
 */
const MARKERS: Record<string, Marker> = {
  '0000_cultured_lady_mastermind': { kind: 'table', table: 'stops' },
  '0001_stop_code': { kind: 'column', table: 'stops', column: 'stop_code' },
  '0002_misty_vargas': { kind: 'table', table: 'blog_articles' },
  '0003_clean_warhawk': { kind: 'table', table: 'blog_categories' },
  '0004_cultured_logan': { kind: 'table', table: 'admin_credentials' },
  '0005_disruptions_devices': { kind: 'table', table: 'disruptions' },
  '0006_disruptions_pushed_at': { kind: 'column', table: 'disruptions', column: 'pushed_at' },
  '0007_disruptions_pushed_at_index': { kind: 'index', index: 'disruptions_pushed_at_idx' },
  '0008_disruptions_pushed_at_backfill': { kind: 'run' },
}

interface JournalEntry {
  idx: number
  when: number
  tag: string
}

const databaseUrl = process.env.NUXT_DATABASE_URL

if (!databaseUrl) {
  throw new Error('Missing NUXT_DATABASE_URL. Add it to .env before running migrations.')
}

/** Everything a pg error can carry — all of it is useful when a migration fails. */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error)

  const pgError = error as Error & {
    code?: string
    detail?: string
    hint?: string
    position?: string
    routine?: string
  }

  const lines = [`${pgError.name}: ${pgError.message}`]
  if (pgError.code) lines.push(`  code:     ${pgError.code}`)
  if (pgError.detail) lines.push(`  detail:   ${pgError.detail}`)
  if (pgError.hint) lines.push(`  hint:     ${pgError.hint}`)
  if (pgError.position) lines.push(`  position: ${pgError.position}`)
  if (pgError.routine) lines.push(`  routine:  ${pgError.routine}`)
  if (pgError.cause instanceof Error) lines.push(`  cause:    ${pgError.cause.message}`)

  return lines.join('\n')
}

function readJournal(): JournalEntry[] {
  const path = join(MIGRATIONS_FOLDER, 'meta', '_journal.json')
  const journal = JSON.parse(readFileSync(path, 'utf8')) as { entries: JournalEntry[] }
  return [...journal.entries].sort((a, b) => a.when - b.when)
}

/** drizzle identifies a migration by the sha256 of its SQL file. */
function hashMigration(tag: string): string {
  const sql = readFileSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf8')
  return createHash('sha256').update(sql).digest('hex')
}

async function main(): Promise<void> {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: resolveSsl(),
    max: 1,
    allowExitOnIdle: true,
    connectionTimeoutMillis: 15_000,
  })

  /** True when the object a migration introduces is already in the database. */
  async function markerExists(marker: Marker): Promise<boolean> {
    if (marker.kind === 'run') return false

    if (marker.kind === 'table') {
      const { rowCount } = await pool.query(
        `select 1 from information_schema.tables
         where table_schema = 'public' and table_name = $1`,
        [marker.table],
      )
      return rowCount === 1
    }

    if (marker.kind === 'column') {
      const { rowCount } = await pool.query(
        `select 1 from information_schema.columns
         where table_schema = 'public' and table_name = $1 and column_name = $2`,
        [marker.table, marker.column],
      )
      return rowCount === 1
    }

    const { rowCount } = await pool.query(
      `select 1 from pg_indexes where schemaname = 'public' and indexname = $1`,
      [marker.index],
    )
    return rowCount === 1
  }

  try {
    // Separate step so a connection/TLS problem is never reported as a
    // migration problem.
    const probe = await pool.query<{ version: string }>('select version()')
    console.info(`[db:migrate] Connected: ${probe.rows[0]?.version ?? 'unknown server'}`)

    // drizzle's own bookkeeping table; creating it up front lets us baseline.
    await pool.query('CREATE SCHEMA IF NOT EXISTS "drizzle"')
    await pool.query(
      `CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
         id SERIAL PRIMARY KEY,
         hash text NOT NULL,
         created_at bigint
       )`,
    )

    const lastApplied = await pool.query<{ created_at: string }>(
      'select created_at from "drizzle"."__drizzle_migrations" order by created_at desc limit 1',
    )
    let watermark = Number(lastApplied.rows[0]?.created_at ?? 0)

    // ── Baseline: record what is already there, execute nothing. ──────────
    const stamped: string[] = []
    const pending: string[] = []

    for (const entry of readJournal()) {
      if (entry.when <= watermark) continue // already recorded

      const marker = MARKERS[entry.tag]
      if (!marker) {
        throw new Error(
          `No marker for migration '${entry.tag}'. Add one to MARKERS in scripts/db-migrate.ts `
          + 'so the runner knows how to detect whether it was already applied.',
        )
      }

      if (!(await markerExists(marker))) {
        // First genuinely missing migration: everything from here is the
        // migrator's job, in file order.
        pending.push(entry.tag)
        continue
      }

      // Only baseline a contiguous prefix: once something is missing, later
      // files must be executed even if their object happens to exist.
      if (pending.length > 0) continue

      if (!DRY_RUN) {
        await pool.query(
          'insert into "drizzle"."__drizzle_migrations" (hash, created_at) values ($1, $2)',
          [hashMigration(entry.tag), entry.when],
        )
      }
      watermark = entry.when
      stamped.push(entry.tag)
    }

    if (stamped.length) {
      console.info(
        `[db:migrate] Already present, recorded without running (${stamped.length}):\n`
        + stamped.map(tag => `  - ${tag}`).join('\n'),
      )
    }

    console.info(
      pending.length
        ? `[db:migrate] To apply (${pending.length}):\n${pending.map(tag => `  - ${tag}`).join('\n')}`
        : '[db:migrate] Nothing to apply.',
    )

    if (DRY_RUN) {
      console.info('[db:migrate] --dry-run: no changes were made.')
      return
    }

    if (pending.length) {
      await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER })
    }

    console.info('[db:migrate] Up to date.')
  }
  catch (error) {
    console.error(`[db:migrate] FAILED\n${describeError(error)}`)
    process.exitCode = 1
  }
  finally {
    await pool.end()
  }
}

await main()
