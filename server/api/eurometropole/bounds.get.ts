/**
 * GET /api/eurometropole/bounds
 *
 * Returns the bounding box of the Eurométropole de Strasbourg as a
 * MapLibre-compatible [[sw_lon, sw_lat], [ne_lon, ne_lat]] tuple.
 *
 * This is the authoritative "max zoom-out" frame for the CTS map.
 * Source: OSM relation 1443391 + data.strasbourg.eu open data portal.
 */
import bbox from '../../data/eurometropole-bbox.json'

export default defineEventHandler(() => {
  return {
    bounds: [
      bbox.sw, // [lon, lat] SW corner
      bbox.ne, // [lon, lat] NE corner
    ] as [[number, number], [number, number]],
  }
})
