/**
 * GET /api/vehicles
 *
 * Returns the latest VehicleSnapshot (REST fallback for the SSE stream).
 *
 * Strict real-time mode:
 *   1. Live CTS data  — whenever the poller published a fresh live snapshot
 *      (see LIVE_FRESH_MS in event-buffer.ts), it is the single source of
 *      truth.
 *   2. Simulation     — GTFS schedule-interpolated positions are served ONLY
 *      when live data is completely unavailable (no token, poller cold or
 *      down, no live vehicle left). Live and theoretical vehicles are never
 *      mixed in one response.
 *
 * The SSE stream (/api/stream/*) applies the same rule through the same
 * event buffer, so all connected clients receive consistent data.
 */

import { VehicleSnapshotSchema } from '~~/shared/schemas/vehicle'
import { latestLiveVehicleEvent } from '../services/realtime/event-buffer'
import { getScheduledSnapshot } from '../services/simulation/scheduled-vehicles'
import { sendNotModified } from '../utils/etag'

export default defineEventHandler(async (event) => {
  // Real-time data: cache only for a few seconds (5.1) and let clients
  // revalidate with If-None-Match (5.2) to save mobile bandwidth.
  setResponseHeader(event, 'Cache-Control', 'public, max-age=5, stale-while-revalidate=10')

  const live = latestLiveVehicleEvent()
  if (live) {
    const snapshot = VehicleSnapshotSchema.parse(live.snapshot)
    if (sendNotModified(event, snapshot)) return
    return snapshot
  }

  // Fallback: theoretical schedule simulation.
  let scheduled
  try {
    scheduled = await getScheduledSnapshot()
  }
  catch (err) {
    // The simulation reads the GTFS timetable from PostgreSQL. When the
    // database is unreachable (bad NUXT_DATABASE_URL, paused instance, …)
    // we degrade to an empty `stale` snapshot instead of a 500, so the map
    // still loads and the connection chip can show the degraded state.
    console.error('[api/vehicles] Scheduled snapshot failed:', err)
    const empty = VehicleSnapshotSchema.parse({
      freshness: 'stale',
      recordedAt: new Date().toISOString(),
      vehicles: [],
    })
    if (sendNotModified(event, empty)) return
    return empty
  }

  // Validated OUTSIDE the try/catch on purpose: a snapshot that violates
  // the schema is a programming error and must fail loudly (500) — never
  // be silently replaced by an empty snapshot.
  const snapshot = VehicleSnapshotSchema.parse(scheduled)
  if (sendNotModified(event, snapshot)) return
  return snapshot
})
