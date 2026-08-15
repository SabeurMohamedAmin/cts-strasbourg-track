/**
 * Lightweight in-process stop coordinate lookup.
 *
 * Used by the poller to resolve coordinates for SIRI vehicle journeys.
 *
 * The cache is keyed by BOTH identifiers of every stop:
 *   - GTFS stop_id   (e.g. "23NOV_01") — used by the schedule simulation
 *   - GTFS stop_code (e.g. "704A")     — the StopPointRef the CTS SIRI
 *                                        real-time API uses in its payloads
 * so lookups work no matter which system the caller has in hand.
 *
 * Stop data is loaded lazily from the Postgres stops table on first call
 * and cached in-memory for the lifetime of the server process.
 *
 * Resilience: when the database is unreachable the load is retried with
 * exponential backoff (5 s → 10 s → … capped at 5 min) instead of caching
 * an empty map forever. Between retries, lookups simply return undefined
 * so the poller degrades gracefully without hammering the database.
 */

interface StopCoords { lat: number, lon: number }

/** First retry delay after a failed load. Doubles on every failure. */
const INITIAL_RETRY_DELAY_MS = 5_000
/** Upper bound for the retry delay. */
const MAX_RETRY_DELAY_MS = 5 * 60_000

let cache: Map<string, StopCoords> | null = null
let loadPromise: Promise<void> | null = null

/** Epoch ms before which a failed load must not be retried. */
let nextRetryAtMs = 0
/** Current backoff delay, doubled after each consecutive failure. */
let retryDelayMs = INITIAL_RETRY_DELAY_MS

async function load(): Promise<void> {
  if (cache) return
  if (loadPromise) { await loadPromise; return }
  if (Date.now() < nextRetryAtMs) return // still backing off after a failure

  loadPromise = (async () => {
    try {
      // Dynamic imports so this module is safe to import at build time
      // even when NUXT_DATABASE_URL is not set (CI, Netlify build step).
      const [{ db }, { stops }] = await Promise.all([
        import('./index'),
        import('./schema/stops'),
      ])

      const rows = await db
        .select({
          stopId: stops.stopId,
          stopCode: stops.stopCode,
          stopLat: stops.stopLat,
          stopLon: stops.stopLon,
        })
        .from(stops)

      cache = new Map()
      for (const r of rows) {
        const coords = { lat: r.stopLat, lon: r.stopLon }
        cache.set(r.stopId, coords)
        if (r.stopCode) cache.set(r.stopCode, coords)
      }

      retryDelayMs = INITIAL_RETRY_DELAY_MS
      console.info(`[stop-coords] Cached ${rows.length} stops (${cache.size} keys).`)
    }
    catch (err) {
      // Graceful degradation: leave the cache null so the first lookup
      // after the backoff window triggers a fresh load attempt. Only the
      // error message is logged — the full stack would repeat on every
      // retry and drown the console during an outage.
      nextRetryAtMs = Date.now() + retryDelayMs
      const reason = err instanceof Error ? err.message : String(err)
      console.warn(
        `[stop-coords] Could not load stop coordinates `
        + `(retrying in ${Math.round(retryDelayMs / 1000)} s): ${reason}`,
      )
      retryDelayMs = Math.min(retryDelayMs * 2, MAX_RETRY_DELAY_MS)
    }
    finally {
      loadPromise = null
    }
  })()

  await loadPromise
}

export async function getStopCoords(
  stopRef: string,
): Promise<StopCoords | undefined> {
  if (!cache) await load()
  return cache?.get(stopRef)
}
