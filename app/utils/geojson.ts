/**
 * Pure GeoJSON builders for the map layers (Step 1.3).
 *
 * No store, no map, no side effects — every function takes plain data in
 * and returns a plain GeoJSON object out, so it can be unit-tested without
 * mocking MapLibre or Pinia.
 */
import type { Feature, FeatureCollection, MultiLineString, Point } from 'geojson'

/**
 * The minimal stop shape the builder needs.
 * A structural subset of the store's Stop interface: anything carrying
 * these four fields can be converted, which keeps this util decoupled
 * from Pinia and easy to feed with fixtures in tests.
 */
export interface StopPointInput {
  stopId: string
  stopName: string
  stopLat: number
  stopLon: number
}

/**
 * Build the FeatureCollection powering the map's 'stops' source.
 *
 * - Coordinates follow the GeoJSON spec order: [longitude, latitude].
 * - The `favourite` property drives the paint expressions of the
 *   'unclustered-stops' layer (amber ring for favourites, red otherwise).
 *
 * @param stops       stops to convert
 * @param favoriteIds favourited stop IDs — a Set for O(1) membership checks
 */
export function buildStopFeatureCollection(
  stops: readonly StopPointInput[],
  favoriteIds: ReadonlySet<string>,
): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: stops.map((stop): Feature<Point> => ({
      type: 'Feature',
      properties: {
        id: stop.stopId,
        name: stop.stopName,
        favourite: favoriteIds.has(stop.stopId),
      },
      geometry: { type: 'Point', coordinates: [stop.stopLon, stop.stopLat] },
    })),
  }
}

/**
 * Bounding box of a MultiLineString as [[west, south], [east, north]] —
 * the format map.fitBounds() expects.
 * Returns null when the geometry has no coordinates at all.
 */
export function multiLineStringBounds(
  geometry: MultiLineString,
): [[number, number], [number, number]] | null {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity

  for (const line of geometry.coordinates) {
    for (const [lon, lat] of line) {
      if (lon === undefined || lat === undefined) continue
      if (lon < west) west = lon
      if (lon > east) east = lon
      if (lat < south) south = lat
      if (lat > north) north = lat
    }
  }

  return west === Infinity ? null : [[west, south], [east, north]]
}
