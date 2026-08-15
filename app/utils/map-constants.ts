/**
 * Static map constants — extracted from MapView.vue (Phase 1, Step 1.1).
 *
 * Pure values only: no reactivity, no imports. They can be used from any
 * component, composable or unit test without pulling in MapLibre or Vue.
 */

/** A [lon, lat] coordinate tuple (GeoJSON order). */
export type LngLatTuple = [number, number]

/** A [[SW], [NE]] bounding box in [lon, lat] order. */
export type BoundsTuple = [LngLatTuple, LngLatTuple]

/**
 * User-validated bounding box for the Eurométropole de Strasbourg (desktop).
 *
 * TWO guards enforce this frame strictly:
 *   1. maxBounds (Map constructor) — MapLibre engine-level pan lock.
 *      The viewport center can NEVER leave this rectangle.
 *      No gliding left / right / up / down past these edges.
 *   2. minZoom (set after fitBounds in fitEurometropole) — zoom-out lock.
 *      The user cannot zoom out past the full-frame view.
 */
export const EUROMETROPOLE_BOUNDS_DESKTOP: BoundsTuple = [
  [7.3897, 48.4572], // SW — user-validated
  [8.1414, 48.6920], // NE — user-validated
]

/** Narrower frame used on mobile breakpoints (md and down) — user-validated. */
export const EUROMETROPOLE_BOUNDS_MOBILE: BoundsTuple = [
  [7.6097, 48.4572], // SW — user-validated
  [7.8414, 48.6920], // NE — user-validated
]

/**
 * Bounds selection for the active breakpoint (Step 2.2).
 *
 * Pure and dependency-free so it can be unit tested without Vuetify or a
 * map instance — useMapFraming feeds it `mdAndDown` from useDisplay().
 */
export function boundsForBreakpoint(isMobile: boolean): BoundsTuple {
  return isMobile ? EUROMETROPOLE_BOUNDS_MOBILE : EUROMETROPOLE_BOUNDS_DESKTOP
}

/**
 * Strasbourg city center (place Kléber area).
 * The Eurométropole bbox is geographically asymmetric, so its midpoint sits
 * north-west of the actual city. We ease onto this point after fitting
 * the frame so Strasbourg lands in the middle of the screen.
 */
export const STRASBOURG_CENTER: LngLatTuple = [7.7442, 48.5840]

/** Extra zoom above the full-frame floor used when focusing the city. */
export const CITY_FOCUS_ZOOM_OFFSET = 0

/**
 * Permissive zoom floor. Used at map creation and re-applied right before
 * every fitBounds so a previously locked (higher) minZoom can never clamp
 * the fit when the frame gets wider (e.g. mobile -> desktop bounds).
 */
export const ABSOLUTE_MIN_ZOOM = 8

/**
 * Font stack that ALWAYS exists on the OpenFreeMap glyph server.
 * The transformRequest glyph fix rewrites the font stack in glyph URLs
 * to this fallback so labels never disappear.
 */
export const OFM_GLYPH_FALLBACK = 'Noto Sans Regular'

/** Debounce before rebuilding custom layers after a base-style swap. */
export const STYLE_RELOAD_DEBOUNCE_MS = 80
