import { describe, it, expect } from 'vitest'

/**
 * Unit tests for the bearing / cardinal direction helpers.
 *
 * Bearing is computed from the last two shape points of a vehicle's
 * trajectory.  A wrong bearing would make the directional arrow on the
 * map point the wrong way.
 */

/**
 * Initial bearing from point A to point B, in degrees clockwise from North.
 * Returns a value in [0, 360).
 */
function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (r: number) => (r * 180) / Math.PI

  const dLon = toRad(lon2 - lon1)
  const y = Math.sin(dLon) * Math.cos(toRad(lat2))
  const x
    = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2))
    - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon)

  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

/** Convert a bearing in degrees to an 8-point cardinal label. */
function bearingToCardinal(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'] as const
  return dirs[Math.round(deg / 45) % 8]!
}

// ---------------------------------------------------------------------------

describe('bearingDeg', () => {
  it('returns 0° (North) when moving straight up', () => {
    const b = bearingDeg(48.58, 7.75, 48.59, 7.75)
    expect(b).toBeCloseTo(0, 0)
  })

  it('returns 180° (South) when moving straight down', () => {
    const b = bearingDeg(48.59, 7.75, 48.58, 7.75)
    expect(b).toBeCloseTo(180, 0)
  })

  it('returns ~90° (East) when moving right along the same latitude', () => {
    const b = bearingDeg(48.58, 7.75, 48.58, 7.76)
    expect(b).toBeGreaterThan(85)
    expect(b).toBeLessThan(95)
  })

  it('returns ~270° (West) when moving left along the same latitude', () => {
    const b = bearingDeg(48.58, 7.76, 48.58, 7.75)
    expect(b).toBeGreaterThan(265)
    expect(b).toBeLessThan(275)
  })

  it('result is always in [0, 360)', () => {
    const cases: [number, number, number, number][] = [
      [48.58, 7.75, 48.59, 7.76],
      [48.59, 7.76, 48.58, 7.75],
      [0, 0, -1, -1],
      [90, 0, -90, 180],
    ]
    for (const [la, lo, lb, lob] of cases) {
      const b = bearingDeg(la, lo, lb, lob)
      expect(b).toBeGreaterThanOrEqual(0)
      expect(b).toBeLessThan(360)
    }
  })
})

describe('bearingToCardinal', () => {
  it('0° → N', () => expect(bearingToCardinal(0)).toBe('N'))
  it('45° → NE', () => expect(bearingToCardinal(45)).toBe('NE'))
  it('90° → E', () => expect(bearingToCardinal(90)).toBe('E'))
  it('135° → SE', () => expect(bearingToCardinal(135)).toBe('SE'))
  it('180° → S', () => expect(bearingToCardinal(180)).toBe('S'))
  it('225° → SO', () => expect(bearingToCardinal(225)).toBe('SO'))
  it('270° → O', () => expect(bearingToCardinal(270)).toBe('O'))
  it('315° → NO', () => expect(bearingToCardinal(315)).toBe('NO'))
  it('359° rounds back to N', () => expect(bearingToCardinal(359)).toBe('N'))
})
