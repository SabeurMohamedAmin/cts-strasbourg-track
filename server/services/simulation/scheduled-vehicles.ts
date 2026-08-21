/**
 * Scheduled vehicle simulator — Phase F.
 *
 * Interpolates theoretical vehicle positions from the static GTFS timetable:
 *   active trip → surrounding stop events → progress fraction → position along shape.
 *
 * Results are published through the same normalised `LiveVehicle` contract the
 * future CTS SIRI adapter will use (Phase E/H), marked `status: 'scheduled'`.
 * Swapping to real-time data later only changes the data source, not the clients.
 *
 * Overnight trip support (Phase F fix):
 *   GTFS permits times > 86 400 s (e.g. 25:30:00) for trips that depart before
 *   midnight on the service day but arrive after midnight.
 *
 * Shape-snapping (tram track accuracy, previous commit):
 *   Bounded lineSlice snap prevents the marker landing on the wrong parallel
 *   track segment on doubled-back routes (Line A, D, etc.).
 *
 * shapePath (this commit — client animation fix):
 *   After resolving the vehicle's current km on the shape, we slice the shape
 *   polyline from that km to the next stop's km and attach the resulting
 *   waypoints as `shapePath` on the LiveVehicle object.
 *
 *   The client-side animation loop (useVehicleLayer.ts) consumes this path
 *   to walk the marker along the real tram track, not a straight line.
 *
 *   The path is intentionally small: the segment between two consecutive stops
 *   on a CTS tram line is typically 4–20 shape points (< 400 bytes JSON),
 *   so the SSE payload overhead is negligible.
 */
import {
  along,
  bearing as turfBearing,
  length as lineLength,
  lineSlice,
  lineString,
  nearestPointOnLine,
  point,
} from '@turf/turf'
import type { Feature, LineString } from 'geojson'
import type { LiveVehicle, VehicleSnapshot } from '../../../shared/types/vehicle'
import { parisClock } from './gtfs-time'
import {
  getDaySchedule,
  type DaySchedule,
  type ScheduledTrip,
  type TripStopEvent,
} from './schedule-cache'

const SNAPSHOT_TTL_MS = 5_000
/** Look-ahead distance (km) used to derive bearing from the shape. */
const BEARING_LOOKAHEAD_KM = 0.02
/**
 * When the bounded snap still produces a km value ≤ the previous stop’s km
 * (degenerate geometry), nudge it forward by this amount.
 */
const FORWARD_CLAMP_EPSILON_KM = 0.001

// ── Per-service-day memos ────────────────────────────────────────────────────
let memoServiceDate = ''
const shapeLineMemo = new Map<string, Feature<LineString>>()
const shapeLengthMemo = new Map<string, number>()
// Key: `shapeId|tripId|stopSequence` — unique per occurrence, fixes terminus loops.
const stopLocationMemo = new Map<string, number>()

function resetMemosIfNewDay(serviceDate: string) {
  if (memoServiceDate === serviceDate) return
  memoServiceDate = serviceDate
  shapeLineMemo.clear()
  shapeLengthMemo.clear()
  stopLocationMemo.clear()
}

function getShapeLine(schedule: DaySchedule, shapeId: string): Feature<LineString> | null {
  const cached = shapeLineMemo.get(shapeId)
  if (cached) return cached
  const coords = schedule.shapeCoords.get(shapeId)
  if (!coords || coords.length < 2) return null
  const line = lineString(coords)
  shapeLineMemo.set(shapeId, line)
  shapeLengthMemo.set(shapeId, lineLength(line))
  return line
}

/**
 * Locate a stop along a shape using a sequence-bounded search window.
 *
 * @param prevKm  The resolved km of the previous stop.
 *               Only shape segments at or beyond this point are searched,
 *               preventing the snap from jumping to a parallel return track.
 */
function locateStopOnShape(
  shapeId: string,
  tripId: string,
  line: Feature<LineString>,
  event: TripStopEvent,
  prevKm: number,
): number {
  const memoKey = `${shapeId}|${tripId}|${event.sequence}`
  const cached = stopLocationMemo.get(memoKey)
  if (cached !== undefined) return cached

  const totalKm = shapeLengthMemo.get(shapeId) ?? lineLength(line)
  const stopPt = point([event.lon, event.lat])

  let resolvedKm: number

  if (prevKm <= 0) {
    const snapped = nearestPointOnLine(line, stopPt)
    resolvedKm = snapped.properties.location ?? 0
  }
  else {
    try {
      const sliceStart = along(line, prevKm)
      const sliceEnd = along(line, totalKm)
      const sliced = lineSlice(sliceStart, sliceEnd, line)
      const snappedOnSlice = nearestPointOnLine(sliced, stopPt)
      const localKm = snappedOnSlice.properties.location ?? 0
      resolvedKm = prevKm + localKm
    }
    catch {
      const snapped = nearestPointOnLine(line, stopPt)
      resolvedKm = snapped.properties.location ?? prevKm
    }
  }

  if (resolvedKm <= prevKm) resolvedKm = prevKm + FORWARD_CLAMP_EPSILON_KM
  resolvedKm = Math.min(resolvedKm, totalKm)

  stopLocationMemo.set(memoKey, resolvedKm)
  return resolvedKm
}

/**
 * Extract the ordered [lon, lat] waypoints from a shape between two km marks.
 *
 * This is what the client uses to animate the tram icon along the real track
 * instead of in a straight line between snapshot coordinates.
 *
 * We prepend `fromPt` and append `toPt` so the path starts and ends exactly
 * at the interpolated vehicle position / next-stop coordinates rather than at
 * the nearest shape vertex.
 */
function sliceShapePath(
  line: Feature<LineString>,
  fromKm: number,
  toKm: number,
): [number, number][] {
  if (toKm <= fromKm) return []
  try {
    const totalKm = lineLength(line)
    const start = along(line, Math.min(fromKm, totalKm))
    const end = along(line, Math.min(toKm, totalKm))
    const sliced = lineSlice(start, end, line)
    return sliced.geometry.coordinates as [number, number][]
  }
  catch {
    return []
  }
}

// ── Position interpolation ─────────────────────────────────────────────────────
interface TripPosition {
  lon: number
  lat: number
  bearing?: number
  nextIndex: number
  /**
   * Shape waypoints already traversed, ending at the vehicle’s current
   * position. The client trims and follows them between two snapshots.
   * Undefined when the vehicle is dwelling at a stop or no shape is available.
   */
  shapePath?: [number, number][]
  /**
   * Shape waypoints from the vehicle’s current position FORWARD to the next
   * stop. On a vehicle’s first sighting the client dead-reckons along this
   * path so it moves immediately instead of waiting for a second snapshot.
   * Undefined when the vehicle is dwelling at a stop — it must stay put.
   */
  pathAhead?: [number, number][]
}

function positionForTrip(
  schedule: DaySchedule,
  trip: ScheduledTrip,
  nowSec: number,
): TripPosition | null {
  const events = trip.events
  const stopKmCache: number[] = new Array(events.length).fill(-1)

  function resolveKm(line: Feature<LineString>, i: number): number {
    if (stopKmCache[i]! >= 0) return stopKmCache[i]!
    const km = locateStopOnShape(
      trip.shapeId!,
      trip.tripId,
      line,
      events[i]!,
      i === 0 ? 0 : (stopKmCache[i - 1] ?? 0),
    )
    stopKmCache[i] = km
    return km
  }

  for (let i = 0; i < events.length; i++) {
    const current = events[i]!
    const next = events[i + 1]

    // Vehicle dwelling at a stop.
    if (nowSec >= current.arrivalSec && nowSec <= current.departureSec) {
      const bearing = next
        ? turfBearing(point([current.lon, current.lat]), point([next.lon, next.lat]))
        : undefined
      return { lon: current.lon, lat: current.lat, bearing, nextIndex: i + 1 }
    }

    // Vehicle travelling between two stops.
    if (next && nowSec > current.departureSec && nowSec < next.arrivalSec) {
      const span = next.arrivalSec - current.departureSec
      const fraction = span > 0 ? (nowSec - current.departureSec) / span : 1

      if (trip.shapeId) {
        const line = getShapeLine(schedule, trip.shapeId)
        if (line) {
          // Resolve all stop km positions up to i+1 in order.
          for (let j = 0; j <= i + 1 && j < events.length; j++) resolveKm(line, j)

          const fromKm = stopKmCache[i]!
          const toKm = stopKmCache[i + 1]!
          const totalKm = shapeLengthMemo.get(trip.shapeId) ?? toKm

          if (toKm > fromKm) {
            const currentKm = fromKm + fraction * (toKm - fromKm)
            const position = along(line, currentKm)
            const ahead = along(line, Math.min(currentKm + BEARING_LOOKAHEAD_KM, totalKm))
            const [lon, lat] = position.geometry.coordinates as [number, number]

            // Send the traversed rail geometry ending at the new snapshot
            // position. The client trims this path from its currently rendered
            // position, so interpolation follows every curve between snapshots
            // instead of taking a straight shortcut between station points.
            const shapePath = sliceShapePath(line, fromKm, currentKm)

            // Also send the geometry AHEAD of the vehicle, up to the next
            // stop. A first-seen vehicle has no previous position to tween
            // from, so the client dead-reckons along this path (paced by the
            // next stop's ETA) instead of standing still until snapshot #2.
            const pathAhead = sliceShapePath(line, currentKm, toKm)

            return {
              lon,
              lat,
              bearing: turfBearing(position, ahead),
              nextIndex: i + 1,
              shapePath: shapePath.length >= 2 ? shapePath : undefined,
              pathAhead: pathAhead.length >= 2 ? pathAhead : undefined,
            }
          }
        }
      }

      // Fallback: straight line (buses with no shape, or malformed GTFS).
      const lon = current.lon + (next.lon - current.lon) * fraction
      const lat = current.lat + (next.lat - current.lat) * fraction
      return {
        lon,
        lat,
        bearing: turfBearing(
          point([current.lon, current.lat]),
          point([next.lon, next.lat]),
        ),
        nextIndex: i + 1,
        // No shape to slice — the straight segment to the next stop still
        // lets a first-seen vehicle start moving immediately.
        pathAhead: [[lon, lat], [next.lon, next.lat]],
      }
    }
  }

  return null
}

function normaliseBearing(b: number | undefined): number | undefined {
  return b === undefined ? undefined : Math.round((b + 360) % 360)
}

const round6 = (v: number) => Math.round(v * 1e6) / 1e6

// ── Public API ────────────────────────────────────────────────────────────
export async function computeScheduledVehicles(): Promise<LiveVehicle[]> {
  const clock = parisClock()
  resetMemosIfNewDay(clock.serviceDate)

  const schedule = await getDaySchedule(clock.serviceDate, clock.weekday)
  const nowSec = clock.secondsSinceMidnight
  const recordedAt = new Date().toISOString()
  const vehicles: LiveVehicle[] = []

  for (const trip of schedule.trips) {
    const adjustedNow = trip.startSec >= 86_400 ? nowSec + 86_400 : nowSec
    if (adjustedNow < trip.startSec || adjustedNow > trip.endSec) continue

    const position = positionForTrip(schedule, trip, adjustedNow)
    if (!position) continue

    const nextEvent = trip.events[position.nextIndex]
    vehicles.push({
      id: `sim-${trip.tripId}`,
      mode: trip.mode,
      lineId: trip.routeId,
      lineLabel: trip.lineLabel,
      destination: trip.headsign,
      latitude: round6(position.lat),
      longitude: round6(position.lon),
      bearing: normaliseBearing(position.bearing),
      status: 'scheduled',
      shapePath: position.shapePath,
      pathAhead: position.pathAhead,
      nextStop: nextEvent
        ? {
            id: nextEvent.stopId,
            name: nextEvent.stopName,
            expectedArrival: new Date(
              Date.now() + (nextEvent.arrivalSec - adjustedNow) * 1_000,
            ).toISOString(),
          }
        : undefined,
      recordedAt,
    })
  }

  return vehicles
}

let snapshotCache: { at: number, value: VehicleSnapshot } | null = null

export async function getScheduledSnapshot(): Promise<VehicleSnapshot> {
  if (snapshotCache && Date.now() - snapshotCache.at < SNAPSHOT_TTL_MS) {
    return snapshotCache.value
  }
  const now = new Date().toISOString()
  const value: VehicleSnapshot = {
    freshness: 'live',
    recordedAt: now,
    lastSuccessfulUpdate: now,
    vehicles: await computeScheduledVehicles(),
  }
  snapshotCache = { at: Date.now(), value }
  return value
}
