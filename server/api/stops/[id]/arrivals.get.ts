/**
 * GET /api/stops/:id/arrivals
 *
 * Returns the next N departures at a stop, merged from two sources:
 *
 *   1. Real time (Phase E) — CTS SIRI StopMonitoring feed.
 *      Entries carry status "live". Only used when NUXT_CTS_API_TOKEN is
 *      configured; responses are cached 30 s server-side (see
 *      server/services/realtime/stop-monitoring.ts) to protect the quota.
 *
 *   2. Schedule — the in-memory GTFS schedule cache (status "scheduled").
 *      Used as a per-line fallback when SIRI has no result for that line.
 *
 * Merge rule:
 *   real time wins for every line represented by SIRI; scheduled arrivals
 *   fill only the missing lines. This keeps live times authoritative without
 *   hiding less frequent lines from multimodal stations.
 *
 * Performance notes — the Home page calls this endpoint ~10× in parallel
 * (once per nearby station), so every per-request cost is paid tenfold:
 *   - stops are read from the in-memory stops cache (no full-table query)
 *   - served lines are computed once per station, then cached 24 h
 *   - a per-day stopId → events index replaces the full trip scan
 *   - route colors come from the schedule cache / served lines — the DB is
 *     never touched on the warm hot path
 *
 * Query params:
 *   limit  — max results returned (default 10, capped at 30)
 *   window — look-ahead in minutes   (default 90, capped at 240)
 *
 * Import note:
 *   In Nuxt 4 with the `app/` directory, the `~` alias resolves to `app/`.
 *   This file lives at `server/api/…` (root), so all imports use `~~`
 *   (project root) to reach sibling `server/` and `shared/` directories.
 */
import { eq, inArray } from 'drizzle-orm'
import { db } from '~~/server/database'
import { routes } from '~~/server/database/schema/routes'
import { stopTimes } from '~~/server/database/schema/stop_times'
import { trips } from '~~/server/database/schema/trips'
import { getMonitoredArrivals } from '~~/server/services/realtime/stop-monitoring'
import { parisClock } from '~~/server/services/simulation/gtfs-time'
import {
  getDaySchedule,
  type DaySchedule,
  type ScheduledTrip,
  type TripStopEvent,
} from '~~/server/services/simulation/schedule-cache'
import { getAllStops } from '~~/server/services/stops-cache'
import { sendNotModified } from '~~/server/utils/etag'
import type { StopArrival, StopArrivalsResponse, StopServedLine } from '~~/shared/types/stop'

/**
 * Internal working shape: a StopArrival plus the GTFS routeId.
 * routeId is "" for real-time entries — their colors are resolved by
 * matching mode + lineLabel against the station's served lines instead.
 */
type ArrivalDraft = StopArrival & { routeId: string }

/**
 * How long this endpoint is willing to WAIT for live CTS data.
 *
 * The GTFS schedule is already in memory, so theoretical times are ready in
 * milliseconds. If CTS has not answered within this budget we respond with
 * scheduled times right away. The CTS request is NOT cancelled: it keeps
 * running in the background and fills the 30 s cache in stop-monitoring.ts.
 * The Home page silently re-fetches every 30 s, so cards are upgraded to
 * live times on the next tick — users never wait for CTS on first paint.
 */
const LIVE_DATA_BUDGET_MS = 500

/**
 * Trips from the PREVIOUS service day only matter shortly after midnight
 * (GTFS records a 23:58 departure arriving at 00:24 as "24:24"). Loading
 * yesterday's full schedule doubles the cold-start cost of the cache, so it
 * is only requested during the night hours where it can actually contribute.
 */
const PREVIOUS_DAY_CUTOFF_SEC = 3 * 3600 // until 03:00 Europe/Paris

/** Served lines change only with a GTFS import — cache them per station. */
const SERVED_LINES_TTL_MS = 24 * 60 * 60 * 1_000
const servedLinesCache = new Map<string, { fetchedAt: number, lines: StopServedLine[] }>()

/** Accent- and case-insensitive station name, used to group sibling platforms. */
function normalizeStopName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim()
}

/** Resolve with the promise result, or `null` once the budget is spent. */
function withTimeBudget<T>(promise: Promise<T>, budgetMs: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const budget = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), budgetMs)
  })
  const guarded = promise
    .catch(() => null) // a live-data failure must never break the response
    .finally(() => clearTimeout(timer))
  return Promise.race([guarded, budget])
}

/**
 * Every line serving the station, from the complete GTFS network (not only
 * the current departure window) so infrequent lines remain visible (for
 * example tram F at Homme de Fer). The underlying DISTINCT join touches
 * stop_times — the largest GTFS table — so results are cached in memory.
 */
async function getServedLines(platformIdList: string[]): Promise<StopServedLine[]> {
  if (!platformIdList.length) return []

  const cacheKey = [...platformIdList].sort().join('|')
  const hit = servedLinesCache.get(cacheKey)
  if (hit && Date.now() - hit.fetchedAt < SERVED_LINES_TTL_MS) return hit.lines

  const rows = await db
    .selectDistinct({
      routeId: routes.routeId,
      lineLabel: routes.routeShortName,
      routeType: routes.routeType,
      routeColor: routes.routeColor,
      routeTextColor: routes.routeTextColor,
    })
    .from(stopTimes)
    .innerJoin(trips, eq(stopTimes.tripId, trips.tripId))
    .innerJoin(routes, eq(trips.routeId, routes.routeId))
    .where(inArray(stopTimes.stopId, platformIdList))

  const lines = rows
    .filter(line => line.routeType === 0 || line.routeType === 3)
    .map(line => ({
      routeId: line.routeId,
      lineLabel: line.lineLabel,
      mode: line.routeType === 0 ? 'tram' as const : 'bus' as const,
      routeColor: line.routeColor ?? 'c8102e',
      routeTextColor: line.routeTextColor ?? 'ffffff',
    }))
    .sort((a, b) => a.lineLabel.localeCompare(b.lineLabel, 'fr', { numeric: true }))

  servedLinesCache.set(cacheKey, { fetchedAt: Date.now(), lines })
  return lines
}

/**
 * stopId → first stop event of every trip passing there.
 *
 * Built once per cached DaySchedule and held in a WeakMap, so it is dropped
 * automatically when the schedule rolls over after midnight. This turns the
 * former "scan every cached trip on every request" into one Map lookup per
 * platform.
 */
interface StopEventEntry { trip: ScheduledTrip, event: TripStopEvent }
const stopEventIndexes = new WeakMap<DaySchedule, Map<string, StopEventEntry[]>>()

function getStopEventIndex(schedule: DaySchedule): Map<string, StopEventEntry[]> {
  const cached = stopEventIndexes.get(schedule)
  if (cached) return cached

  const index = new Map<string, StopEventEntry[]>()
  for (const trip of schedule.trips) {
    const seenStops = new Set<string>()
    for (const tripEvent of trip.events) {
      // Loop routes can visit a stop twice — keep the first pass only,
      // matching the former `trip.events.find(...)` behaviour.
      if (seenStops.has(tripEvent.stopId)) continue
      seenStops.add(tripEvent.stopId)
      let entries = index.get(tripEvent.stopId)
      if (!entries) index.set(tripEvent.stopId, entries = [])
      entries.push({ trip, event: tripEvent })
    }
  }
  stopEventIndexes.set(schedule, index)
  return index
}

export default defineEventHandler(async (event): Promise<StopArrivalsResponse> => {
  const stopId = getRouterParam(event, 'id')
  if (!stopId) throw createError({ statusCode: 400, message: 'stopId requis' })

  const query = getQuery(event)
  const requestedLimit = Number(query.limit ?? 10)
  const requestedWindow = Number(query.window ?? 90)
  if (!Number.isFinite(requestedLimit) || !Number.isFinite(requestedWindow)) {
    throw createError({ statusCode: 400, message: 'Paramètres limit/window invalides' })
  }
  const limit = Math.min(Math.max(Math.trunc(requestedLimit), 1), 30)
  const windowMinutes = Math.min(Math.max(Math.trunc(requestedWindow), 1), 240)

  // ── Resolve stop + sibling platforms from the in-memory stops cache ──────
  const allStops = await getAllStops()
  const stopRow = allStops.find(candidate => candidate.stopId === stopId)
  if (!stopRow) throw createError({ statusCode: 404, message: 'Arrêt introuvable' })

  // A physical station can contain one GTFS stop per travel direction. Resolve
  // every sibling platform so one response includes both outbound and return.
  const normalizedName = normalizeStopName(stopRow.stopName)
  const stationPlatforms = allStops.filter((candidate) => {
    if (stopRow.parentStation) return candidate.parentStation === stopRow.parentStation
    return normalizeStopName(candidate.stopName) === normalizedName
  })
  const platformIds = new Set(stationPlatforms.map(platform => platform.stopId))
  const platformIdList = [...platformIds]
  const monitoringCodes = [...new Set(stationPlatforms.map(platform => platform.stopCode).filter((code): code is string => Boolean(code)))]

  // ── Fetch all sources in parallel ────────────────────────────────────────
  const clock = parisClock()
  const includePreviousDay = clock.secondsSinceMidnight < PREVIOUS_DAY_CUTOFF_SEC

  const forceRefresh = Boolean(query.refresh || query._t)

  const [servedLines, schedule, monitoredByPlatform] = await Promise.all([
    getServedLines(platformIdList),
    // Departure cards need stop events, not the full network shape geometry.
    // Skipping shapes makes the first favorites-page load substantially faster.
    getDaySchedule(clock.serviceDate, clock.weekday, includePreviousDay, false),
    // Each platform gets the same short budget, in parallel: live data is a
    // bonus, never something the theoretical schedule has to wait for.
    Promise.all(monitoringCodes.map(code =>
      withTimeBudget(getMonitoredArrivals(code, forceRefresh), LIVE_DATA_BUDGET_MS),
    )),
  ])
  const monitored = monitoredByPlatform.flatMap(arrivals => arrivals ?? [])

  const nowMs = Date.now()
  const windowMs = windowMinutes * 60_000

  // Colors for live entries come from the served-lines cache (they carry no
  // GTFS routeId), keyed by mode + label to disambiguate bus/tram homonyms.
  const lineColorByKey = new Map(servedLines.map(line => [`${line.mode}:${line.lineLabel}`, line]))

  // ── Source 1: real-time SIRI StopMonitoring (status "live") ──────────────
  // Keep departures inside the window; tolerate up to 1 min in the past so a
  // vehicle currently at the platform is still shown as "À quai".
  const liveArrivals: ArrivalDraft[] = monitored
    .filter((m) => {
      const t = new Date(m.expectedArrival).getTime()
      return Number.isFinite(t) && t >= nowMs - 60_000 && t <= nowMs + windowMs
    })
    .map((m) => {
      const line = lineColorByKey.get(`${m.mode}:${m.lineLabel}`)
      return {
        tripId: m.journeyRef,
        lineLabel: m.lineLabel,
        destination: m.destination,
        scheduledArrival: m.expectedArrival,
        mode: m.mode,
        routeId: '',
        routeColor: line?.routeColor ?? 'c8102e',
        routeTextColor: line?.routeTextColor ?? 'ffffff',
        status: 'live' as const,
      }
    })

  // ── Source 2: GTFS schedule cache (status "scheduled") ───────────────────
  // The per-day index maps each platform to its trips. For each trip keep its
  // earliest event among the station's platforms — identical semantics to the
  // former full scan with `trip.events.find(...)`, at a fraction of the cost.
  // Overnight trips (GTFS times > 86 400 s) are handled by adjusting nowSec
  // so the window comparison stays correct across midnight.
  const nowSec = clock.secondsSinceMidnight
  const windowSec = windowMinutes * 60

  const stopEventIndex = getStopEventIndex(schedule)
  const bestEventByTrip = new Map<string, StopEventEntry>()
  for (const platformId of platformIdList) {
    for (const entry of stopEventIndex.get(platformId) ?? []) {
      const existing = bestEventByTrip.get(entry.trip.tripId)
      if (!existing || entry.event.sequence < existing.event.sequence) {
        bestEventByTrip.set(entry.trip.tripId, entry)
      }
    }
  }

  const scheduledArrivals: ArrivalDraft[] = schedule.activeServiceIds.size
    ? [...bestEventByTrip.values()].flatMap(({ trip, event: ev }) => {
        // Trips that start on the previous service day have startSec >= 86 400.
        // Add 86 400 to nowSec so the arithmetic stays consistent.
        const adjustedNow = trip.startSec >= 86_400 ? nowSec + 86_400 : nowSec
        if (ev.arrivalSec < adjustedNow || ev.arrivalSec > adjustedNow + windowSec) return []

        const msDiff = (ev.arrivalSec - adjustedNow) * 1_000
        return [{
          tripId: trip.tripId,
          lineLabel: trip.lineLabel,
          destination: trip.headsign,
          scheduledArrival: new Date(nowMs + msDiff).toISOString(),
          mode: trip.mode,
          routeId: trip.routeId,
          // Colors were cached alongside the trip — no DB round-trip needed.
          routeColor: trip.routeColor,
          routeTextColor: trip.routeTextColor,
          status: 'scheduled' as const,
        }]
      })
    : []

  // ── Merge: live data with a per-line schedule fallback ──────────────────
  // SIRI can return only a subset of a station's lines. A station-wide
  // fallback therefore hides valid lines (for example tram F) as soon as any
  // other line has live data. Keep SIRI authoritative for represented lines
  // and fill absent lines from GTFS.
  const liveLineKeys = new Set(liveArrivals.map(arrival => `${arrival.mode}:${arrival.lineLabel}`))
  const candidates = [
    ...liveArrivals,
    ...scheduledArrivals.filter(arrival => !liveLineKeys.has(`${arrival.mode}:${arrival.lineLabel}`)),
  ]
    .filter((arrival, index, source) => source.findIndex(candidate =>
      candidate.tripId === arrival.tripId
      && candidate.lineLabel === arrival.lineLabel
      && candidate.destination === arrival.destination,
    ) === index)
    .sort((a, b) => a.scheduledArrival.localeCompare(b.scheduledArrival))

  // Reserve one slot per active line before filling the remaining slots in
  // chronological order. Frequent lines can no longer crowd a less frequent
  // line out of the response limit.
  const firstByLine = new Map<string, ArrivalDraft>()
  for (const arrival of candidates) {
    const key = `${arrival.mode}:${arrival.lineLabel}`
    if (!firstByLine.has(key)) firstByLine.set(key, arrival)
  }
  const required = [...firstByLine.values()]
  const requiredTrips = new Set(required.map(arrival => `${arrival.tripId}:${arrival.lineLabel}:${arrival.destination}`))
  const merged = [
    ...required,
    ...candidates.filter(arrival => !requiredTrips.has(`${arrival.tripId}:${arrival.lineLabel}:${arrival.destination}`)),
  ]
    .slice(0, Math.max(limit, required.length))
    .sort((a, b) => a.scheduledArrival.localeCompare(b.scheduledArrival))

  const body: StopArrivalsResponse = {
    stopId,
    stopName: stopRow.stopName,
    servedLines,
    arrivals: merged.map(({ routeId: _routeId, ...arrival }) => arrival),
  }

  // Real-time arrivals: short cache (5.1) + conditional GET (5.2). A forced
  // refresh (?refresh / ?_t) must never be answered from any cache.
  setResponseHeader(event, 'Cache-Control', forceRefresh
    ? 'no-store'
    : 'public, max-age=10, stale-while-revalidate=20')
  if (sendNotModified(event, body)) return undefined
  return body
})
