/**
 * Day schedule cache — Phase F.
 *
 * Loads everything needed to simulate vehicle positions for one service day
 * (active trips, their ordered stop events and route shapes) into memory,
 * so the interpolation code never touches PostgreSQL on the hot path.
 *
 * The cache is keyed by service date and reloads automatically after midnight.
 *
 * Overnight-trip support (previous-day midnight-crossing trips):
 *   GTFS permits times > 86 400 s for trips that *depart* before midnight on
 *   service day D but *arrive* after midnight (i.e. early hours of D+1).
 *   Example: last tram departs 23:58 on Friday (service day D), arrives at
 *   the terminus at 00:24 — GTFS records that arrival as 24:24 = 87 840 s.
 *
 *   When the app runs at 00:10 on Saturday, `parisClock()` returns service
 *   date Saturday and secondsSinceMidnight ≈ 600.  The Saturday schedule
 *   contains no trip starting at 87 600 s+ because those trips belonged to
 *   the Friday service.  Without this fix those vehicles are completely absent.
 *
 *   Fix: `getDaySchedule` accepts `includePreviousDay: true`.  It then also
 *   loads the Friday schedule, keeps only trips with endSec > 86 400 (they
 *   cross midnight), and merges them into the Saturday schedule.  The callers
 *   (computeScheduledVehicles + arrivals endpoint) both set the flag.
 *
 * Route-colour caching:
 *   routeColor + routeTextColor are fetched once during loadDaySchedule
 *   (they are already available in the trip/route join) and stored on each
 *   ScheduledTrip, so the /api/stops/:id/arrivals hot path is fully DB-free.
 */
import { eq, inArray } from 'drizzle-orm'
import { db } from '../../database'
import { calendar, calendarDates } from '../../database/schema/calendar'
import { routes } from '../../database/schema/routes'
import { shapes } from '../../database/schema/shapes'
import { stops } from '../../database/schema/stops'
import { stopTimes } from '../../database/schema/stop_times'
import { trips } from '../../database/schema/trips'
import { parseGtfsTime, type WeekdayKey } from './gtfs-time'

export interface TripStopEvent {
  stopId: string
  stopName: string
  lat: number
  lon: number
  arrivalSec: number
  departureSec: number
  sequence: number
}

export interface ScheduledTrip {
  tripId: string
  routeId: string
  lineLabel: string
  /** Official CTS hex colour of the route (no leading #), e.g. "c8102e". */
  routeColor: string
  /** Foreground hex colour for text drawn on top of routeColor. */
  routeTextColor: string
  mode: 'bus' | 'tram'
  headsign: string
  /** GTFS direction_id (0 = outbound, 1 = return). Defaults to 0 when absent. */
  directionId: number
  shapeId: string | null
  /** Departure at the first stop, seconds since midnight of the *service day*. */
  startSec: number
  /** Arrival at the last stop, seconds since midnight of the *service day*.
   *  May exceed 86 400 for overnight trips. */
  endSec: number
  events: TripStopEvent[]
}

export interface DaySchedule {
  serviceDate: string
  trips: ScheduledTrip[]
  /** shapeId → ordered [lon, lat] coordinates. */
  shapeCoords: Map<string, [number, number][]>
  /** Resolved service IDs, kept for external consumers (e.g. re-cache checks). */
  activeServiceIds: Set<string>
}

const DB_CHUNK_SIZE = 500

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size))
  }
  return result
}

// ---------------------------------------------------------------------------
// Service-ID resolution
// ---------------------------------------------------------------------------

/** Resolve which service IDs run on the given date (calendar + calendar_dates). */
async function getActiveServiceIds(
  serviceDate: string,
  weekday: WeekdayKey,
): Promise<Set<string>> {
  const allServices = await db.select().from(calendar)

  const active = new Set(
    allServices
      .filter(
        service =>
          service[weekday]
          && service.startDate <= serviceDate
          && service.endDate >= serviceDate,
      )
      .map(service => service.serviceId),
  )

  const exceptions = await db
    .select()
    .from(calendarDates)
    .where(eq(calendarDates.date, serviceDate))

  for (const exception of exceptions) {
    if (exception.exceptionType === 1) active.add(exception.serviceId)
    if (exception.exceptionType === 2) active.delete(exception.serviceId)
  }

  return active
}

/**
 * Derive the previous GTFS service date string (YYYYMMDD).
 * Handles month/year boundaries correctly via the Date API.
 */
function previousServiceDate(serviceDate: string): string {
  // serviceDate is YYYYMMDD — parse it into a UTC midnight Date.
  const y = Number(serviceDate.slice(0, 4))
  const m = Number(serviceDate.slice(4, 6)) - 1 // 0-indexed month
  const d = Number(serviceDate.slice(6, 8))
  const prev = new Date(Date.UTC(y, m, d - 1))
  const yy = prev.getUTCFullYear().toString()
  const mm = String(prev.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(prev.getUTCDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

/** Map service date YYYYMMDD → lowercase weekday key. */
function weekdayForDate(serviceDate: string): WeekdayKey {
  const y = Number(serviceDate.slice(0, 4))
  const m = Number(serviceDate.slice(4, 6)) - 1
  const d = Number(serviceDate.slice(6, 8))
  const day = new Date(Date.UTC(y, m, d)).getUTCDay() // 0 = Sunday
  const keys: WeekdayKey[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return keys[day]!
}

// ---------------------------------------------------------------------------
// Core loader
// ---------------------------------------------------------------------------

async function loadTripsForServiceIds(
  serviceIds: string[],
): Promise<{ scheduledTrips: ScheduledTrip[], shapeIds: string[] }> {
  if (!serviceIds.length) return { scheduledTrips: [], shapeIds: [] }

  // 1. Trips + route metadata in one join.
  const tripRows = await db
    .select({
      tripId: trips.tripId,
      routeId: trips.routeId,
      shapeId: trips.shapeId,
      headsign: trips.tripHeadsign,
      directionId: trips.directionId,
      routeShortName: routes.routeShortName,
      routeLongName: routes.routeLongName,
      routeType: routes.routeType,
      // Route colours are fetched once here so hot-path code never needs the DB.
      routeColor: routes.routeColor,
      routeTextColor: routes.routeTextColor,
    })
    .from(trips)
    .innerJoin(routes, eq(trips.routeId, routes.routeId))
    .where(inArray(trips.serviceId, serviceIds))

  // 2. Stop events for all those trips (chunked to avoid huge IN lists).
  const tripIds = tripRows.map(t => t.tripId)
  const eventsByTrip = new Map<string, TripStopEvent[]>()

  for (const tripIdChunk of chunk(tripIds, DB_CHUNK_SIZE)) {
    const rows = await db
      .select({
        tripId: stopTimes.tripId,
        stopId: stopTimes.stopId,
        arrivalTime: stopTimes.arrivalTime,
        departureTime: stopTimes.departureTime,
        sequence: stopTimes.stopSequence,
        stopName: stops.stopName,
        lat: stops.stopLat,
        lon: stops.stopLon,
      })
      .from(stopTimes)
      .innerJoin(stops, eq(stopTimes.stopId, stops.stopId))
      .where(inArray(stopTimes.tripId, tripIdChunk))

    for (const row of rows) {
      const arrivalSec = parseGtfsTime(row.arrivalTime)
      const departureSec = parseGtfsTime(row.departureTime)
      if (arrivalSec === null || departureSec === null) continue

      const events = eventsByTrip.get(row.tripId) ?? []
      events.push({
        stopId: row.stopId,
        stopName: row.stopName,
        lat: row.lat,
        lon: row.lon,
        arrivalSec,
        departureSec,
        sequence: row.sequence,
      })
      eventsByTrip.set(row.tripId, events)
    }
  }

  // 3. Assemble + validate.
  const scheduledTrips: ScheduledTrip[] = []
  for (const trip of tripRows) {
    const events = eventsByTrip.get(trip.tripId)
    if (!events || events.length < 2) continue

    events.sort((a, b) => a.sequence - b.sequence)
    scheduledTrips.push({
      tripId: trip.tripId,
      routeId: trip.routeId,
      lineLabel: trip.routeShortName,
      routeColor: trip.routeColor ?? 'c8102e',
      routeTextColor: trip.routeTextColor ?? 'ffffff',
      mode: trip.routeType === 0 ? 'tram' : 'bus',
      headsign: trip.headsign ?? trip.routeLongName ?? trip.routeShortName,
      directionId: trip.directionId ?? 0,
      shapeId: trip.shapeId,
      startSec: events[0]!.departureSec,
      endSec: events[events.length - 1]!.arrivalSec,
      events,
    })
  }

  const shapeIds = scheduledTrips
    .map(t => t.shapeId)
    .filter((id): id is string => id !== null)

  return { scheduledTrips, shapeIds }
}

async function loadShapeCoords(
  shapeIds: string[],
): Promise<Map<string, [number, number][]>> {
  const shapeCoords = new Map<string, [number, number][]>()
  const uniqueIds = [...new Set(shapeIds)]

  for (const shapeIdChunk of chunk(uniqueIds, DB_CHUNK_SIZE)) {
    const rows = await db
      .select({
        shapeId: shapes.shapeId,
        lat: shapes.shapePtLat,
        lon: shapes.shapePtLon,
        sequence: shapes.shapePtSequence,
      })
      .from(shapes)
      .where(inArray(shapes.shapeId, shapeIdChunk))

    const grouped = new Map<string, { lat: number, lon: number, sequence: number }[]>()
    for (const row of rows) {
      const pts = grouped.get(row.shapeId) ?? []
      pts.push(row)
      grouped.set(row.shapeId, pts)
    }

    for (const [shapeId, pts] of grouped) {
      pts.sort((a, b) => a.sequence - b.sequence)
      shapeCoords.set(shapeId, pts.map(p => [p.lon, p.lat]))
    }
  }

  return shapeCoords
}

/**
 * Load the full schedule for `serviceDate`.
 *
 * When `includePreviousDay` is true, trips from the previous service day
 * whose `endSec > 86 400` (i.e. they run past midnight into today) are
 * merged into the returned schedule so vehicles near midnight are visible.
 */
async function loadDaySchedule(
  serviceDate: string,
  weekday: WeekdayKey,
  includePreviousDay = false,
  includeShapes = true,
): Promise<DaySchedule> {
  // ── Today ──────────────────────────────────────────────────────────────────
  const activeServiceIds = await getActiveServiceIds(serviceDate, weekday)
  const todayServiceList = [...activeServiceIds]

  const { scheduledTrips: todayTrips, shapeIds: todayShapeIds }
    = await loadTripsForServiceIds(todayServiceList)

  let allTrips = todayTrips
  let allShapeIds = todayShapeIds

  // ── Previous service day (midnight-crossing trips) ────────────────────────
  if (includePreviousDay) {
    const prevDate = previousServiceDate(serviceDate)
    const prevWeekday = weekdayForDate(prevDate)
    const prevServiceIds = await getActiveServiceIds(prevDate, prevWeekday)

    const { scheduledTrips: prevTrips, shapeIds: prevShapeIds }
      = await loadTripsForServiceIds([...prevServiceIds])

    // Keep only those that actually cross midnight (endSec > 86 400).
    // We avoid duplicating trip IDs that appear in both service calendars.
    const todayTripIds = new Set(todayTrips.map(t => t.tripId))
    const overnightTrips = prevTrips.filter(
      t => t.endSec > 86_400 && !todayTripIds.has(t.tripId),
    )

    if (overnightTrips.length > 0) {
      console.info(
        `[schedule-cache] Merged ${overnightTrips.length} overnight trip(s) from previous service day ${prevDate}`,
      )
      allTrips = [...todayTrips, ...overnightTrips]
      allShapeIds = [...todayShapeIds, ...prevShapeIds]
    }
  }

  // Arrival screens only need stop events. Loading every route polyline is
  // comparatively expensive, so callers can skip shapes without affecting
  // the richer vehicle-simulation cache.
  const shapeCoords = includeShapes
    ? await loadShapeCoords(allShapeIds)
    : new Map<string, [number, number][]>()

  console.info(
    `[schedule-cache] Loaded ${allTrips.length} trips / ${shapeCoords.size} shapes for service date ${serviceDate}`,
  )

  return { serviceDate, trips: allTrips, shapeCoords, activeServiceIds }
}

// ---------------------------------------------------------------------------
// Public cache API
// ---------------------------------------------------------------------------

const scheduleCaches = new Map<string, Promise<DaySchedule>>()

/**
 * Return an in-memory schedule for today.
 *
 * Arrival pages can pass `includeShapes: false` because they only need stop
 * events. Simulation callers keep the default complete schedule. The two
 * variants use separate cache entries so a lightweight request can never
 * deprive the map simulation of route geometry.
 */
export function getDaySchedule(
  serviceDate: string,
  weekday: WeekdayKey,
  includePreviousDay = true,
  includeShapes = true,
): Promise<DaySchedule> {
  const cacheKey = `${serviceDate}:${includePreviousDay}:${includeShapes}`
  const cached = scheduleCaches.get(cacheKey)
  if (cached) return cached

  const schedule = loadDaySchedule(serviceDate, weekday, includePreviousDay, includeShapes).catch(
    (error) => {
      // Allow the next call to retry rather than caching a rejection.
      scheduleCaches.delete(cacheKey)
      throw error
    },
  )
  scheduleCaches.set(cacheKey, schedule)

  // Keep only variants for the current service date.
  for (const key of scheduleCaches.keys()) {
    if (!key.startsWith(`${serviceDate}:`)) scheduleCaches.delete(key)
  }

  return schedule
}
