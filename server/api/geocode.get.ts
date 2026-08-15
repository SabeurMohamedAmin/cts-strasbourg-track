/**
 * GET /api/geocode?q=<free text>
 *
 * Searches addresses, streets and cities through the French national address
 * API (Base Adresse Nationale — free, no API key required).
 *
 * Why a server proxy instead of calling BAN from the browser?
 *   - keeps the client decoupled from the third-party API (easy to swap later)
 *   - lets us bias + hard-filter results server-side, in one place
 *
 * Results are:
 *   1. biased towards Strasbourg city centre (lat/lon ranking hint)
 *   2. hard-filtered to the Eurométropole bounding box — the same frame the
 *      map is locked to (see MapView.vue), so we never return a place the
 *      user could not navigate to anyway.
 */
import type { GeocodeResult } from '~~/shared/types/geocode'

/** Raw GeoJSON feature shape returned by the BAN /search endpoint. */
interface BanFeature {
  geometry: { coordinates: [number, number] } // [lon, lat]
  properties: {
    id: string
    label: string
    type: GeocodeResult['type']
    city?: string
    postcode?: string
  }
}

const BAN_SEARCH_URL = 'https://api-adresse.data.gouv.fr/search/'

/** Strasbourg city centre (place Kléber area) — ranks nearby results first. */
const BIAS_LAT = 48.584
const BIAS_LON = 7.7442

/** Eurométropole frame — mirrors the user-validated bounds in MapView.vue. */
const BBOX = { west: 7.5597, south: 48.4572, east: 7.9414, north: 48.692 }

const geocodeCache = new Map<string, { expiresAt: number, results: GeocodeResult[] }>()
const GEOCODE_TTL_MS = 10 * 60_000 // 10 minutes

export default defineEventHandler(async (event): Promise<GeocodeResult[]> => {
  const { q } = getQuery(event)
  const query = typeof q === 'string' ? q.trim().toLowerCase() : ''

  // The BAN API rejects queries shorter than 3 characters.
  if (query.length < 3) return []

  const now = Date.now()
  const cached = geocodeCache.get(query)
  if (cached && cached.expiresAt > now) {
    setHeader(event, 'Cache-Control', 'public, max-age=600')
    return cached.results
  }

  try {
    const data = await $fetch<{ features: BanFeature[] }>(BAN_SEARCH_URL, {
      query: { q: query, limit: 10, lat: BIAS_LAT, lon: BIAS_LON },
    })

    const results = data.features
      .filter((feature) => {
        const [lon, lat] = feature.geometry.coordinates
        return (
          lon >= BBOX.west && lon <= BBOX.east
          && lat >= BBOX.south && lat <= BBOX.north
        )
      })
      .map((feature): GeocodeResult => {
        const [lon, lat] = feature.geometry.coordinates
        const { id, label, type, city, postcode } = feature.properties
        return {
          id,
          label,
          // "67000 Strasbourg" — skip missing parts gracefully.
          context: [postcode, city].filter(Boolean).join(' '),
          type,
          lat,
          lon,
        }
      })

    if (geocodeCache.size > 200) {
      for (const [key, entry] of geocodeCache) {
        if (entry.expiresAt <= now) geocodeCache.delete(key)
      }
    }
    geocodeCache.set(query, { expiresAt: now + GEOCODE_TTL_MS, results })

    setHeader(event, 'Cache-Control', 'public, max-age=600')
    return results
  }
  catch (error) {
    console.error('[api/geocode] BAN request failed', error)
    throw createError({ statusCode: 502, statusMessage: 'Service de géocodage indisponible' })
  }
})
