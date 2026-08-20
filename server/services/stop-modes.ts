/**
 * In-memory served-lines cache — routes and modes per stop.
 *
 * Derived from GTFS stop_times → trips → routes, which is far too heavy to
 * run per request: the join scans the whole stop_times table. Like the stops
 * cache, it is loaded once, the promise is shared so concurrent requests
 * never duplicate the query, and a TTL picks up fresh GTFS imports.
 */
import { eq } from 'drizzle-orm'
import { db } from '../database'
import { stopTimes } from '../database/schema/stop_times'
import { trips } from '../database/schema/trips'
import { routes } from '../database/schema/routes'

export interface StopMembership {
  routes: Set<string>
  modes: Set<'tram' | 'bus'>
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1_000 // 6 h — GTFS imports are rare

interface MembershipCacheEntry {
  loadedAt: number
  byStop: Promise<Map<string, StopMembership>>
}

let cacheEntry: MembershipCacheEntry | null = null

async function loadMemberships(): Promise<Map<string, StopMembership>> {
  // GTFS route_type: 0 = tram, 3 = bus (same mapping as /api/stops).
  const memberships = await db
    .selectDistinct({
      stopId: stopTimes.stopId,
      routeId: trips.routeId,
      routeType: routes.routeType,
    })
    .from(stopTimes)
    .innerJoin(trips, eq(stopTimes.tripId, trips.tripId))
    .innerJoin(routes, eq(trips.routeId, routes.routeId))

  const byStop = new Map<string, StopMembership>()
  for (const membership of memberships) {
    const entry = byStop.get(membership.stopId)
      ?? { routes: new Set<string>(), modes: new Set<'tram' | 'bus'>() }
    entry.routes.add(membership.routeId)
    if (membership.routeType === 0) entry.modes.add('tram')
    if (membership.routeType === 3) entry.modes.add('bus')
    byStop.set(membership.stopId, entry)
  }
  return byStop
}

/** Routes and modes served per stop id, from memory when warm. */
export function getStopModes(): Promise<Map<string, StopMembership>> {
  if (cacheEntry && Date.now() - cacheEntry.loadedAt < CACHE_TTL_MS) {
    return cacheEntry.byStop
  }

  const byStop = loadMemberships()
  const entry: MembershipCacheEntry = { loadedAt: Date.now(), byStop }
  cacheEntry = entry

  // A failed load must not poison the cache: drop it so the next call retries.
  byStop.catch(() => {
    if (cacheEntry === entry) cacheEntry = null
  })

  return byStop
}
