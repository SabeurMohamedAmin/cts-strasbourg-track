/**
 * In-memory stops cache — shared by the hot location endpoints.
 *
 * The GTFS `stops` table only changes when a new dataset is imported, yet
 * /api/stops/nearby and /api/stops/:id/arrivals used to reload the FULL
 * table from PostgreSQL on every request (and the Home page fires ~10
 * arrivals requests per location fix).
 *
 * The table is loaded once and the promise is shared, so concurrent
 * requests never duplicate the query. A generous TTL picks up fresh GTFS
 * imports without requiring a server restart.
 */
import { db } from '../database'
import { stops, type Stop } from '../database/schema/stops'

const CACHE_TTL_MS = 6 * 60 * 60 * 1_000 // 6 h — GTFS imports are rare

interface StopsCacheEntry {
  loadedAt: number
  rows: Promise<Stop[]>
}

let cacheEntry: StopsCacheEntry | null = null

/** All GTFS stops, served from memory when warm. Rejections are never cached. */
export function getAllStops(): Promise<Stop[]> {
  if (cacheEntry && Date.now() - cacheEntry.loadedAt < CACHE_TTL_MS) {
    return cacheEntry.rows
  }

  const rows: Promise<Stop[]> = db.select().from(stops).then(result => result)
  const entry: StopsCacheEntry = { loadedAt: Date.now(), rows }
  cacheEntry = entry

  // A failed load must not poison the cache: drop it so the next call retries.
  rows.catch(() => {
    if (cacheEntry === entry) cacheEntry = null
  })

  return rows
}
