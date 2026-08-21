/**
 * shape-interpolate.ts
 *
 * Projects a progress ratio [0..1] onto a GTFS shape polyline and returns
 * the interpolated [longitude, latitude].
 *
 * Why this exists:
 *   The original useVehicleLayer tween moved vehicles in a straight line
 *   between two snapshot coordinates.  On curved routes (tram line A, etc.)
 *   this made vehicles cut across buildings.  By projecting along the actual
 *   shape we get smooth, road-following movement.
 *
 * Falls back to linear interpolation if no shape is provided.
 */

export type ShapeCoord = [lon: number, lat: number]

/**
 * Project a ratio along a polyline.
 *
 * @param shape  Ordered array of [lon, lat] from GTFS shapes.txt
 * @param ratio  Progress along the route, 0 = start, 1 = end
 * @returns      Interpolated [lon, lat]
 */
export function projectAlongShape(shape: ShapeCoord[], ratio: number): ShapeCoord {
  if (!shape.length) throw new Error('Empty shape passed to projectAlongShape')
  if (ratio <= 0) return shape[0]!
  if (ratio >= 1) return shape[shape.length - 1]!

  // Pre-compute cumulative arc lengths.
  let totalLength = 0
  const segLengths: number[] = []

  for (let i = 1; i < shape.length; i++) {
    const d = euclideanDist(shape[i - 1]!, shape[i]!)
    segLengths.push(d)
    totalLength += d
  }

  if (totalLength === 0) return shape[0]! // Degenerate shape (all same point).

  const target = ratio * totalLength
  let accumulated = 0

  for (let i = 0; i < segLengths.length; i++) {
    const segLen = segLengths[i]!
    if (accumulated + segLen >= target) {
      const localRatio = (target - accumulated) / segLen
      const a = shape[i]!
      const b = shape[i + 1]!
      return [
        a[0] + (b[0] - a[0]) * localRatio,
        a[1] + (b[1] - a[1]) * localRatio,
      ]
    }
    accumulated += segLen
  }

  // Floating-point rounding may land here; return the last point.
  return shape[shape.length - 1]!
}

/**
 * Fast 2D Euclidean distance (degrees).  Accurate enough for short segments
 * at Strasbourg's latitude — no need for Haversine on sub-kilometre gaps.
 */
function euclideanDist(a: ShapeCoord, b: ShapeCoord): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Linear fallback — used when no shape is available for a trip.
 */
export function linearInterpolate(
  fromLon: number, fromLat: number,
  toLon: number, toLat: number,
  ratio: number,
): ShapeCoord {
  return [
    fromLon + (toLon - fromLon) * ratio,
    fromLat + (toLat - fromLat) * ratio,
  ]
}
