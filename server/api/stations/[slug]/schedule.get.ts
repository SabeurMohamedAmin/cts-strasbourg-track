/**
 * GET /api/stations/:slug/schedule
 *
 * Full-day THEORETICAL timetable for a station, grouped for direct display:
 *
 *   lines[]                 — every line serving the station today
 *     directions[]          — one entry per GTFS direction_id (outbound / return)
 *       hours[]             — departure minutes grouped by hour
 *
 * Directions are grouped by GTFS `direction_id`, NOT by headsign: lines run
 * short-turn trips that terminate mid-route (e.g. tram A ending at "Etoile
 * Bourse"), and grouping by headsign would wrongly surface those termini as
 * extra directions. The most frequent headsign labels each direction, and
 * every terminus stays listed in `headsigns` so live arrivals can be matched.
 *
 * The station is addressed by its SLUG (e.g. "cite-de-l-ill"), the URL-safe
 * form of its name — see shared/utils/slug.ts. Slugs are resolved against the
 * in-memory stops cache through a lazily built index, so lookups are O(1).
 *
 * Timetable data comes exclusively from the in-memory GTFS day-schedule cache
 * (see server/services/simulation/schedule-cache.ts): after the first call
 * of the day this endpoint never touches PostgreSQL.
 *
 * Import note:
 *   In Nuxt 4 with the `app/` directory, the `~` alias resolves to `app/`.
 *   This file lives at `server/api/…` (root), so all imports use `~~`
 *   (project root) — same convention as the stops arrivals endpoint.
 */
import { parisClock } from '~~/server/services/simulation/gtfs-time'
import { getDaySchedule, type TripStopEvent } from '~~/server/services/simulation/schedule-cache'
import { getAllStops } from '~~/server/services/stops-cache'
import type { ScheduleLine, StopScheduleResponse } from '~~/shared/types/schedule'
import { slugifyStopName } from '~~/shared/utils/slug'

type StopRow = Awaited<ReturnType<typeof getAllStops>>[number]

/**
 * slug → stops sharing that station name.
 *
 * Keyed by the stops-cache array itself (WeakMap), so the index is rebuilt
 * automatically whenever the cache is refreshed and never leaks memory.
 */
const slugIndexes = new WeakMap<StopRow[], Map<string, StopRow[]>>()

function getStopsBySlug(allStops: StopRow[]): Map<string, StopRow[]> {
  const cached = slugIndexes.get(allStops)
  if (cached) return cached

  const index = new Map<string, StopRow[]>()
  for (const stop of allStops) {
    const slug = slugifyStopName(stop.stopName)
    const entries = index.get(slug)
    if (entries) entries.push(stop)
    else index.set(slug, [stop])
  }
  slugIndexes.set(allStops, index)
  return index
}

/** Working shape while one direction is being aggregated. */
interface DirectionDraft {
  /** headsign → number of trips displaying it (most frequent = main label). */
  headsignCounts: Map<string, number>
  /** hour → departure minutes. */
  hours: Map<number, Set<number>>
}

/** Working shape while trips are aggregated: direction_id → hours. */
interface LineDraft {
  routeId: string
  lineLabel: string
  mode: 'bus' | 'tram'
  routeColor: string
  routeTextColor: string
  directions: Map<number, DirectionDraft>
}

/**
 * The timetable is theoretical: for a given station and service date the
 * response never changes. Caching the final payload means only the FIRST
 * visitor of the day pays the full-network trip scan below.
 * Keys include the service date, so the day rollover invalidates naturally.
 */
const responseCache = new Map<string, StopScheduleResponse>()
const RESPONSE_CACHE_MAX = 600 // safely above the number of stations

export default defineEventHandler(async (event): Promise<StopScheduleResponse> => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, message: 'slug requis' })

  const clock = parisClock()
  const cacheKey = `${slug}:${clock.serviceDate}`
  const cachedResponse = responseCache.get(cacheKey)
  if (cachedResponse) {
    setResponseHeader(event, 'Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
    return cachedResponse
  }

  // ── Resolve slug → station platforms ─────────────────────────────────
  const allStops = await getAllStops()
  const matchedStops = getStopsBySlug(allStops).get(slug) ?? []
  if (!matchedStops.length) throw createError({ statusCode: 404, message: 'Station introuvable' })

  // A physical station can contain one GTFS stop per travel direction:
  // keep every platform matching the slug, plus siblings sharing a parent.
  const parentIds = new Set(
    matchedStops
      .map(stop => stop.parentStation)
      .filter((parent): parent is string => Boolean(parent)),
  )
  const platformIds = new Set(matchedStops.map(stop => stop.stopId))
  for (const candidate of allStops) {
    if (candidate.parentStation && parentIds.has(candidate.parentStation)) {
      platformIds.add(candidate.stopId)
    }
  }
  const primaryStop = matchedStops[0]!

  // ── Aggregate today's cached trips into line → direction → hour ──────────
  const schedule = await getDaySchedule(clock.serviceDate, clock.weekday, false, false)

  const drafts = new Map<string, LineDraft>()

  for (const trip of schedule.trips) {
    // First pass of the trip at this station (loop routes can stop twice).
    let stopEvent: TripStopEvent | undefined
    for (const tripEvent of trip.events) {
      if (!platformIds.has(tripEvent.stopId)) continue
      if (!stopEvent || tripEvent.sequence < stopEvent.sequence) stopEvent = tripEvent
    }
    if (!stopEvent) continue

    const lineKey = `${trip.mode}:${trip.lineLabel}`
    let draft = drafts.get(lineKey)
    if (!draft) {
      drafts.set(lineKey, draft = {
        routeId: trip.routeId,
        lineLabel: trip.lineLabel,
        mode: trip.mode,
        routeColor: trip.routeColor,
        routeTextColor: trip.routeTextColor,
        directions: new Map(),
      })
    }

    let direction = draft.directions.get(trip.directionId)
    if (!direction) {
      draft.directions.set(trip.directionId, direction = { headsignCounts: new Map(), hours: new Map() })
    }
    direction.headsignCounts.set(trip.headsign, (direction.headsignCounts.get(trip.headsign) ?? 0) + 1)

    // Riders read timetables as departure times. Hours may reach 24-25 for
    // after-midnight trips, keeping those rows sorted after 23h.
    const hour = Math.floor(stopEvent.departureSec / 3600)
    const minute = Math.floor((stopEvent.departureSec % 3600) / 60)
    let minutes = direction.hours.get(hour)
    if (!minutes) direction.hours.set(hour, minutes = new Set())
    minutes.add(minute)
  }

  // ── Freeze drafts into the sorted response shape ──────────────────────────
  const lines: ScheduleLine[] = [...drafts.values()]
    .map(draft => ({
      routeId: draft.routeId,
      lineLabel: draft.lineLabel,
      mode: draft.mode,
      routeColor: draft.routeColor,
      routeTextColor: draft.routeTextColor,
      directions: [...draft.directions.entries()]
        .map(([directionId, direction]) => {
          // Most frequent headsign labels the direction; short-turn termini
          // remain in `headsigns` so live arrivals can still be matched.
          const headsigns = [...direction.headsignCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([headsign]) => headsign)
          return {
            directionId,
            headsign: headsigns[0] ?? '',
            headsigns,
            hours: [...direction.hours.entries()]
              .map(([hour, minutes]) => ({ hour, minutes: [...minutes].sort((a, b) => a - b) }))
              .sort((a, b) => a.hour - b.hour),
          }
        })
        .sort((a, b) => a.directionId - b.directionId),
    }))
    .sort((a, b) => a.lineLabel.localeCompare(b.lineLabel, 'fr', { numeric: true }))

  const date = `${clock.serviceDate.slice(0, 4)}-${clock.serviceDate.slice(4, 6)}-${clock.serviceDate.slice(6, 8)}`

  const response = { slug, stopId: primaryStop.stopId, stopName: primaryStop.stopName, date, lines }

  // Entries from previous service days are dead keys — clear when full.
  if (responseCache.size >= RESPONSE_CACHE_MAX) responseCache.clear()
  responseCache.set(cacheKey, response)

  setResponseHeader(event, 'Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
  return response
})
