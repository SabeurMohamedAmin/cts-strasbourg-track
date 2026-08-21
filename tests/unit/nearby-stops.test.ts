import { describe, it, expect } from 'vitest'

/**
 * Unit tests for the nearby-stops distance calculation.
 *
 * The Haversine formula is the critical path here: a wrong implementation
 * would return incorrect distances and sort stops in the wrong order.
 */

const EARTH_RADIUS_M = 6_371_000

/** Haversine distance in metres between two WGS-84 coordinates. */
function haversineMetres(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a
    = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}

describe('haversineMetres', () => {
  it('returns 0 for the same point', () => {
    expect(haversineMetres(48.58, 7.75, 48.58, 7.75)).toBe(0)
  })

  it('returns ~111 km per degree latitude', () => {
    const d = haversineMetres(0, 0, 1, 0)
    expect(d).toBeGreaterThan(110_000)
    expect(d).toBeLessThan(112_000)
  })

  it('is symmetric (A→B == B→A)', () => {
    const a = haversineMetres(48.58, 7.75, 48.59, 7.76)
    const b = haversineMetres(48.59, 7.76, 48.58, 7.75)
    expect(a).toBeCloseTo(b, 2)
  })

  it('Place Kléber to Homme de Fer is ~200 m', () => {
    // Approximate real-world stop positions in Strasbourg.
    const kleber = { lat: 48.5839, lon: 7.7479 }
    const hdF = { lat: 48.5834, lon: 7.7494 }
    const d = haversineMetres(kleber.lat, kleber.lon, hdF.lat, hdF.lon)
    // Real distance is ~140 m; we allow a generous range for approximate coords.
    expect(d).toBeGreaterThan(50)
    expect(d).toBeLessThan(400)
  })
})

// ---------------------------------------------------------------------------
// Sorting logic
// ---------------------------------------------------------------------------

describe('nearby stops sort', () => {
  type Stop = { stopId: string, lat: number, lon: number }

  function sortByDistance(stops: Stop[], userLat: number, userLon: number) {
    return [...stops]
      .map(s => ({ ...s, distanceM: Math.round(haversineMetres(userLat, userLon, s.lat, s.lon)) }))
      .sort((a, b) => a.distanceM - b.distanceM)
  }

  it('sorts closer stops first', () => {
    const stops: Stop[] = [
      { stopId: 'far', lat: 48.60, lon: 7.75 },
      { stopId: 'near', lat: 48.581, lon: 7.749 },
    ]
    const sorted = sortByDistance(stops, 48.5839, 7.7479)
    expect(sorted[0]!.stopId).toBe('near')
    expect(sorted[1]!.stopId).toBe('far')
  })

  it('attaches correct distanceM', () => {
    const stops: Stop[] = [{ stopId: 'a', lat: 48.5839, lon: 7.7479 }]
    const sorted = sortByDistance(stops, 48.5839, 7.7479)
    expect(sorted[0]!.distanceM).toBe(0)
  })
})
