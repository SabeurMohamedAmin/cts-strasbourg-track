/**
 * GET /api/v1/health (ROADMAP_NITRO_API 6.2).
 *
 * Liveness/readiness probe for the host and for client diagnostics. Reports
 * the two dependencies the public API cannot serve correct data without:
 *
 *   database  — PostgreSQL (GTFS, blog, disruptions). Checked with a cheap
 *               `select 1`; a failure flips the overall status to 'degraded'.
 *   ctsPoller — whether the CTS real-time poller has published fresh live
 *               data recently. 'disabled' when no CTS token is configured
 *               (the schedule simulation then serves vehicles instead).
 *
 * Always answers 200: a health endpoint that errors cannot be distinguished
 * from a dead process by an uptime checker. The `status` field carries the
 * degraded signal instead.
 */
import { sql } from 'drizzle-orm'
import { latestLiveVehicleEvent } from '../services/realtime/event-buffer'
import { isCtsTokenConfigured } from '../services/realtime/cts-client'
import type { HealthStatus } from '~~/shared/types/api-v1'

export default defineEventHandler(async (): Promise<HealthStatus> => {
  // Database: cheap connectivity probe. Lazy pool means a missing
  // NUXT_DATABASE_URL throws here rather than at import time.
  let database: HealthStatus['checks']['database'] = 'up'
  try {
    const { db } = await import('../database')
    await db.execute(sql`select 1`)
  }
  catch {
    database = 'down'
  }

  // CTS poller: fresh live snapshot within LIVE_FRESH_MS means 'live'.
  const ctsPoller: HealthStatus['checks']['ctsPoller'] = !isCtsTokenConfigured()
    ? 'disabled'
    : latestLiveVehicleEvent()
      ? 'live'
      : 'stale'

  const degraded = database === 'down' || ctsPoller === 'stale'

  return {
    status: degraded ? 'degraded' : 'ok',
    time: new Date().toISOString(),
    checks: { database, ctsPoller },
  }
})
