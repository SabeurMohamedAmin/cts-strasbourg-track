/**
 * Public API base path.
 *
 * Both clients, this web app and the Flutter app, consume the SAME versioned
 * surface: /api/v1. Nothing outside /api/v1 is public, with one deliberate
 * exception: the admin endpoints stay unversioned, because /api/v1/admin/**
 * answers 404 by design.
 *
 * See ROADMAP_FLUTTER 1.8 (web alignment gate) and ROADMAP_NITRO_API 2.4.
 */
export const API_V1 = '/api/v1'

/**
 * Builds a versioned API path.
 *
 *   apiV1('/stops')                -> '/api/v1/stops'
 *   apiV1(`/stops/${id}/arrivals`) -> '/api/v1/stops/275/arrivals'
 */
export function apiV1(path: string): string {
  return `${API_V1}${path}`
}
