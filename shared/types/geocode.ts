/**
 * Geocoding result returned by GET /api/geocode.
 * Shared between the server route (producer) and the client composable (consumer).
 */
export interface GeocodeResult {
  /** Stable id from the BAN API (e.g. "67482_1450_00012"). */
  id: string
  /** Human-readable label, e.g. "12 Rue du Faubourg National 67000 Strasbourg". */
  label: string
  /** Short context line shown under the label, e.g. "67000 Strasbourg". */
  context: string
  /** Result precision: full address, street, named place, or whole city. */
  type: 'housenumber' | 'street' | 'locality' | 'municipality'
  lat: number
  lon: number
}
