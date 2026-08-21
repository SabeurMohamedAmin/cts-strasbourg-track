/**
 * Static landmark reference points shown on the map.
 *
 * These are well-known Strasbourg locations that help users orient
 * themselves at a glance. Unlike stops or vehicles, this data never
 * changes at runtime: no store, no API call, just constants.
 *
 * Each landmark carries:
 *   - a stable `id` used to build its MapLibre image name
 *   - its display `name` (label under the pin)
 *   - `coordinates` in GeoJSON [lon, lat] order
 *   - an accent `color` unique to the landmark
 *   - a `glyph` function returning white SVG shapes drawn in a 24x24 box.
 *     It receives the accent color so cut-out details (visor, windows,
 *     ball seams) match the badge background.
 */
import type maplibregl from 'maplibre-gl'
import type { LngLatTuple } from '~/utils/map-constants'

/** Layer id of the landmark pins. Shared with isLandmarkClick() below. */
export const LANDMARK_ICON_LAYER = 'landmark-pins'

/**
 * True when a map click landed on a landmark pin.
 *
 * Landmark pins often sit right on top of stop icons (Homme de Fer,
 * Gare Centrale and Hoenheim Gare are all stops too). MapLibre fires the
 * click handlers of EVERY layer under the cursor, so without this guard a
 * landmark click would also select the stop underneath and open its
 * details sheet. Stop layers call this first and yield if it returns true,
 * so landmark clicks only zoom + center.
 */
export function isLandmarkClick(
  map: maplibregl.Map,
  point: { x: number, y: number },
): boolean {
  if (!map.getLayer(LANDMARK_ICON_LAYER)) return false
  return map.queryRenderedFeatures([point.x, point.y], {
    layers: [LANDMARK_ICON_LAYER],
  }).length > 0
}

export interface Landmark {
  /** Stable slug, e.g. 'homme-de-fer'. Used in MapLibre image ids. */
  id: string
  /** Human-readable name shown as the map label. */
  name: string
  /** [lon, lat] position (GeoJSON order). */
  coordinates: LngLatTuple
  /** Accent color for the pin badge. */
  color: string
  /** White SVG markup for a 24x24 box; `accent` is the badge color. */
  glyph: (accent: string) => string
}

export const LANDMARKS: Landmark[] = [
  {
    id: 'homme-de-fer',
    name: 'Homme de Fer',
    coordinates: [7.7442, 48.5836],
    color: '#546e7a', // steel grey — a nod to the "iron man"
    // A knight's helmet: rounded dome with an accent-colored visor slot.
    glyph: accent => `
      <path fill="#FFFFFF" d="M12 2.5c-4.1 0-7.5 3.4-7.5 7.5v9.8l3.6-1.9v-4.4h7.8v4.4l3.6 1.9V10c0-4.1-3.4-7.5-7.5-7.5z"/>
      <rect x="7.2" y="8.8" width="9.6" height="2.4" rx="1.2" fill="${accent}"/>`,
  },
  {
    id: 'gare-centrale',
    name: 'Gare Centrale',
    coordinates: [7.7349, 48.5852],
    color: '#c62828', // signal red, railway style
    // A train seen from the front: windshield, two headlights.
    glyph: accent => `
      <path fill="#FFFFFF" d="M12 2C8.7 2 5.5 2.4 5.5 5.5v10c0 1.4 1.1 2.5 2.5 2.5l-1.5 2v1h2.2l1.5-2h3.6l1.5 2h2.2v-1L16 18c1.4 0 2.5-1.1 2.5-2.5v-10C18.5 2.4 15.3 2 12 2z"/>
      <rect x="7.2" y="5.2" width="9.6" height="4.6" rx="1" fill="${accent}"/>
      <circle cx="8.8" cy="14.3" r="1.3" fill="${accent}"/>
      <circle cx="15.2" cy="14.3" r="1.3" fill="${accent}"/>`,
  },
  {
    id: 'republique',
    name: 'République',
    coordinates: [7.7547, 48.5866],
    color: '#1565c0', // institutional blue
    // A classical portico: pediment, four columns, base — the palaces
    // around place de la République.
    glyph: () => `
      <path fill="#FFFFFF" d="M12 2 3.5 6.8v1.7h17V6.8L12 2z"/>
      <rect x="4.4" y="10" width="2.6" height="7.2" fill="#FFFFFF"/>
      <rect x="8.9" y="10" width="2.6" height="7.2" fill="#FFFFFF"/>
      <rect x="13.4" y="10" width="2.6" height="7.2" fill="#FFFFFF"/>
      <rect x="17.9" y="10" width="2.6" height="7.2" fill="#FFFFFF"/>
      <rect x="3.5" y="18.6" width="17" height="2.6" rx="0.8" fill="#FFFFFF"/>`,
  },
  {
    id: 'stade-meinau',
    name: 'Stade de la Meinau',
    coordinates: [7.7550, 48.5601],
    color: '#2e7d32', // pitch green
    // A soccer ball: central pentagon plus five seams.
    glyph: accent => `
      <circle cx="12" cy="12" r="9.5" fill="#FFFFFF"/>
      <path fill="${accent}" d="M12 7.2 8.6 9.7l1.3 4h4.2l1.3-4z"/>
      <path stroke="${accent}" stroke-width="1.4" fill="none" stroke-linecap="round"
        d="M12 7.2V3.6M8.6 9.7 5.2 8.6M9.9 13.7l-2.1 2.9M14.1 13.7l2.1 2.9M15.4 9.7l3.4-1.1"/>`,
  },
  {
    id: 'hoenheim-gare',
    name: 'Hoenheim Gare',
    coordinates: [7.7582, 48.6249],
    color: '#6a1b9a', // deep purple for the northern tram terminus
    // A tram with its pantograph arm raised.
    glyph: accent => `
      <path fill="#FFFFFF" d="M16.5 6.2h-3.4l1.9-2.5-1.2-.9L11 6.2H7.5C6.1 6.2 5 7.3 5 8.7v7.6c0 1 .6 1.9 1.4 2.3L5.2 20.4v.6h2.3l1.4-1.5h6.2l1.4 1.5h2.3v-.6l-1.2-1.8c.8-.4 1.4-1.3 1.4-2.3V8.7c0-1.4-1.1-2.5-2.5-2.5z"/>
      <rect x="7.2" y="8.6" width="9.6" height="4" rx="1" fill="${accent}"/>
      <circle cx="12" cy="15.9" r="1.4" fill="${accent}"/>`,
  },
]

// SVG canvas dimensions (match the viewBox in generateLandmarkPinSvg)
export const LANDMARK_PIN_W = 44
export const LANDMARK_PIN_H = 52

/**
 * Generates the SVG for one landmark pin.
 *
 * Deliberately different from the teardrop stop pins so landmarks read as
 * "places", not "stops": a rounded square badge in the landmark's accent
 * color with a white border, a small pointer tail at the bottom, and the
 * landmark's white glyph centered inside.
 */
export function generateLandmarkPinSvg(landmark: Landmark): string {
  return `<svg xmlns="https://www.w3.org/2000/svg" width="${LANDMARK_PIN_W}" height="${LANDMARK_PIN_H}" viewBox="0 0 ${LANDMARK_PIN_W} ${LANDMARK_PIN_H}">
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.35"/>
    </filter>
    <g filter="url(#shadow)">
      <path d="M22 49 L15 38 H29 Z" fill="${landmark.color}"/>
      <rect x="4" y="3" width="36" height="36" rx="11" fill="${landmark.color}" stroke="#FFFFFF" stroke-width="2.5"/>
      <g transform="translate(10, 9)">
        ${landmark.glyph(landmark.color)}
      </g>
    </g>
  </svg>`
}
