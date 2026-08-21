/**
 * live-position.ts — derive a vehicle position from SIRI call times.
 *
 * CTS provides no GPS feed, but the EstimatedTimetable service gives us the
 * expected arrival/departure time at EVERY stop of the journey. Combined
 * with the GTFS stop coordinates, this is enough to place the vehicle:
 *
 *   time is before the first call    → waiting at the first stop
 *   arrival ≤ now ≤ departure       → dwelling at that stop
 *   between two consecutive calls   → travelling: linear interpolation by
 *                                     elapsed-time fraction between stops
 *   time is after the last call     → parked at the terminus
 *
 * Pure functions only (no I/O, no imports from the DB layer) so this module
 * is trivially unit-testable.
 */

import { bearing as turfBearing, point } from '@turf/turf'

/** One stop of the journey with resolved coordinates and epoch times. */
export interface TimedPoint {
  lon: number
  lat: number
  /** Best known arrival at this stop, epoch ms. */
  arrivalMs: number
  /** Best known departure from this stop, epoch ms (≥ arrivalMs). */
  departureMs: number
  stopRef: string
  stopName: string
}

export interface LivePosition {
  lon: number
  lat: number
  /** Heading in degrees [0..360), when a direction can be derived. */
  bearing?: number
  /** Index in the TimedPoint list of the next stop to be served. */
  nextIndex: number
  /**
   * True only when the vehicle is strictly between two stops: it has
   * departed the previous one and not yet arrived at the next. Waiting at
   * the first stop, dwelling and being parked at the terminus all report
   * false — such vehicles must not be dead-reckoned by the client.
   */
  travelling: boolean
}

function normaliseBearing(b: number): number {
  return Math.round((b + 360) % 360)
}

/** Bearing from points[i] towards the following point, if any. */
function bearingFrom(points: TimedPoint[], i: number): number | undefined {
  const a = points[i]
  const b = points[i + 1]
  if (!a || !b) return undefined
  return normaliseBearing(turfBearing(point([a.lon, a.lat]), point([b.lon, b.lat])))
}

/**
 * Compute the vehicle position at `nowMs` from its timed stop sequence.
 * Returns null when the sequence is empty.
 */
export function interpolatePosition(
  points: TimedPoint[],
  nowMs: number,
): LivePosition | null {
  if (!points.length) return null

  const first = points[0]!
  const last = points[points.length - 1]!

  // Journey not started yet — vehicle waiting at (or approaching) first stop.
  if (nowMs <= first.arrivalMs) {
    return { lon: first.lon, lat: first.lat, bearing: bearingFrom(points, 0), nextIndex: 0, travelling: false }
  }

  // Journey finished — parked at the terminus.
  if (nowMs >= last.departureMs) {
    return { lon: last.lon, lat: last.lat, nextIndex: points.length - 1, travelling: false }
  }

  for (let i = 0; i < points.length; i++) {
    const current = points[i]!
    const next = points[i + 1]

    // Dwelling at a stop.
    if (nowMs >= current.arrivalMs && nowMs <= current.departureMs) {
      return {
        lon: current.lon,
        lat: current.lat,
        bearing: bearingFrom(points, i),
        nextIndex: Math.min(i + 1, points.length - 1),
        travelling: false,
      }
    }

    // Travelling between two stops.
    if (next && nowMs > current.departureMs && nowMs < next.arrivalMs) {
      const span = next.arrivalMs - current.departureMs
      const fraction = span > 0 ? (nowMs - current.departureMs) / span : 1
      return {
        lon: current.lon + (next.lon - current.lon) * fraction,
        lat: current.lat + (next.lat - current.lat) * fraction,
        bearing: bearingFrom(points, i),
        nextIndex: i + 1,
        travelling: true,
      }
    }
  }

  // Out-of-order timestamps in the feed — fall back to the next known stop.
  return { lon: last.lon, lat: last.lat, nextIndex: points.length - 1, travelling: false }
}
