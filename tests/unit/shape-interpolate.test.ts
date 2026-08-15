import { describe, it, expect } from 'vitest'

/**
 * Unit tests for shape-projected interpolation.
 *
 * We inline the pure geometry helpers here so the tests have zero
 * dependency on the database or Nuxt server.
 */

type Coord = [lon: number, lat: number]

/** Euclidean distance squared (fast, good enough for unit tests). */
function dist2(a: Coord, b: Coord): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  return dx * dx + dy * dy
}

/**
 * Project a ratio [0..1] along a polyline of coordinates.
 * Returns the interpolated [lon, lat].
 */
function projectAlongPolyline(coords: Coord[], ratio: number): Coord {
  if (coords.length === 0) throw new Error('Empty shape')
  if (ratio <= 0) return coords[0]!
  if (ratio >= 1) return coords[coords.length - 1]!

  // Total length of the polyline.
  let total = 0
  const segments: number[] = []
  for (let i = 1; i < coords.length; i++) {
    const d = Math.sqrt(dist2(coords[i - 1]!, coords[i]!))
    segments.push(d)
    total += d
  }

  const target = ratio * total
  let accumulated = 0

  for (let i = 0; i < segments.length; i++) {
    const segLen = segments[i]!
    if (accumulated + segLen >= target) {
      const localRatio = (target - accumulated) / segLen
      const a = coords[i]!
      const b = coords[i + 1]!
      return [
        a[0] + (b[0] - a[0]) * localRatio,
        a[1] + (b[1] - a[1]) * localRatio,
      ]
    }
    accumulated += segLen
  }

  return coords[coords.length - 1]!
}

// ---------------------------------------------------------------------------

describe('projectAlongPolyline', () => {
  const line: Coord[] = [
    [7.750, 48.580],
    [7.755, 48.582],
    [7.760, 48.585],
  ]

  it('returns the first point at ratio 0', () => {
    const result = projectAlongPolyline(line, 0)
    expect(result[0]).toBeCloseTo(7.750)
    expect(result[1]).toBeCloseTo(48.580)
  })

  it('returns the last point at ratio 1', () => {
    const result = projectAlongPolyline(line, 1)
    expect(result[0]).toBeCloseTo(7.760)
    expect(result[1]).toBeCloseTo(48.585)
  })

  it('returns the midpoint at ratio 0.5 on a two-point line', () => {
    const twoPoints: Coord[] = [[0, 0], [10, 0]]
    const result = projectAlongPolyline(twoPoints, 0.5)
    expect(result[0]).toBeCloseTo(5)
    expect(result[1]).toBeCloseTo(0)
  })

  it('stays on the polyline and not on the chord', () => {
    // A right-angle path: right then up.
    const path: Coord[] = [[0, 0], [10, 0], [10, 10]]
    // Total length = 10 + 10 = 20.  At ratio 0.5 we should be at (10, 0).
    const mid = projectAlongPolyline(path, 0.5)
    expect(mid[0]).toBeCloseTo(10)
    expect(mid[1]).toBeCloseTo(0)
  })

  it('handles a single-segment line at ratio 0.25', () => {
    const seg: Coord[] = [[0, 0], [8, 0]]
    const result = projectAlongPolyline(seg, 0.25)
    expect(result[0]).toBeCloseTo(2)
    expect(result[1]).toBeCloseTo(0)
  })
})
