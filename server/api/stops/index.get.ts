import { db } from '~~/server/database'
import { stops } from '~~/server/database/schema/stops'
import { stopTimes } from '~~/server/database/schema/stop_times'
import { trips } from '~~/server/database/schema/trips'
import { routes } from '~~/server/database/schema/routes'
import { eq } from 'drizzle-orm'

let cachedStopsResponse: any = null

export default defineEventHandler(async (event) => {
  const { type } = getQuery(event)
  const isStation = type === 'station'

  if (cachedStopsResponse && cachedStopsResponse[isStation ? 'station' : 'stop']) {
    setHeader(event, 'Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
    return cachedStopsResponse[isStation ? 'station' : 'stop']
  }

  const stopRows = await db
    .select()
    .from(stops)
    .where(isStation ? eq(stops.locationType, 1) : eq(stops.locationType, 0))

  // Derive transport membership from GTFS stop_times → trips → routes.
  // A shared interchange may correctly contain both modes; ordinary stops now
  // appear only in their corresponding tram or bus MapLibre source.
  const memberships = await db
    .selectDistinct({
      stopId: stopTimes.stopId,
      routeId: trips.routeId,
      routeType: routes.routeType,
    })
    .from(stopTimes)
    .innerJoin(trips, eq(stopTimes.tripId, trips.tripId))
    .innerJoin(routes, eq(trips.routeId, routes.routeId))

  const byStop = new Map<string, { routes: Set<string>, modes: Set<'tram' | 'bus'> }>()
  for (const membership of memberships) {
    const entry = byStop.get(membership.stopId) ?? { routes: new Set(), modes: new Set() }
    entry.routes.add(membership.routeId)
    if (membership.routeType === 0) entry.modes.add('tram')
    if (membership.routeType === 3) entry.modes.add('bus')
    byStop.set(membership.stopId, entry)
  }

  const result = stopRows.map((stop) => {
    const membership = byStop.get(stop.stopId)
    return {
      ...stop,
      routes: [...(membership?.routes ?? [])],
      modes: [...(membership?.modes ?? [])],
    }
  })

  if (!cachedStopsResponse) cachedStopsResponse = {}
  cachedStopsResponse[isStation ? 'station' : 'stop'] = result

  setHeader(event, 'Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  return result
})
