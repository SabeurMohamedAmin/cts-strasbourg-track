/**
 * GET /api/v1/stops/:id/next-departures (ROADMAP_NITRO_API 8.5).
 *
 * Tiny payload for a home-screen widget: the next few departures at a stop,
 * stripped to the bare fields a widget renders. It reuses the full arrivals
 * handler (same merge of live + scheduled) and projects the result down, so
 * the widget and the app never disagree about times.
 *
 * Aggressive Cache-Control: a widget polls on a fixed cadence and tolerates
 * slightly stale times, so we let the platform cache harder than the app.
 *
 * Query params:
 *   limit — max departures (default 3, capped at 5: widgets show very few)
 */
import { sendNotModified } from '../../../utils/etag'
import type { StopArrivalsResponse } from '~~/shared/types/stop'
import type { NextDeparture, NextDeparturesResponse } from '~~/shared/types/api-v1'

export default defineEventHandler(async (event): Promise<NextDeparturesResponse | undefined> => {
  const stopId = getRouterParam(event, 'id')
  if (!stopId) throw createError({ statusCode: 400, message: 'stop id required' })

  const query = getQuery(event)
  const parsed = Number(query.limit ?? 3)
  const limit = Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), 1), 5) : 3

  // Reuse the authoritative arrivals merge (live + scheduled) via an internal
  // call, exactly like the bulk /api/stops/arrivals endpoint does.
  const arrivals = await event.$fetch<StopArrivalsResponse>(
    `/api/stops/${encodeURIComponent(stopId)}/arrivals`,
    { query: { limit, window: 120 } },
  )

  const departures: NextDeparture[] = arrivals.arrivals.map(arrival => ({
    lineLabel: arrival.lineLabel,
    destination: arrival.destination,
    departure: arrival.scheduledArrival,
    status: arrival.status,
    routeColor: arrival.routeColor,
    routeTextColor: arrival.routeTextColor,
  }))

  const body: NextDeparturesResponse = {
    stopId: arrivals.stopId,
    stopName: arrivals.stopName,
    departures,
  }

  // Widgets poll infrequently and tolerate staleness: cache harder than the app.
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60, stale-while-revalidate=120')
  if (sendNotModified(event, body)) return undefined
  return body
})
