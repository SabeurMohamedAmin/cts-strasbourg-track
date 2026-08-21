import type maplibregl from 'maplibre-gl'
import type { Feature, FeatureCollection, Point } from 'geojson'
import type { Ref } from 'vue'
import type { Landmark } from '~/utils/landmarks'
import { LANDMARKS, LANDMARK_ICON_LAYER, LANDMARK_PIN_H, LANDMARK_PIN_W, generateLandmarkPinSvg } from '~/utils/landmarks'
import { svgToImageData } from '~/utils/markerGenerator'

const SOURCE      = 'landmarks'
const ICON_LAYER  = LANDMARK_ICON_LAYER
const LABEL_LAYER = 'landmark-labels'

/**
 * Street-level zoom used when a landmark pin is clicked.
 * Matches the zoom used when a stop is selected, and corresponds to
 * roughly four "+" clicks from the initial full-frame view.
 */
const LANDMARK_FOCUS_ZOOM = 15

/** MapLibre image id for one landmark, e.g. "landmark-pin-homme-de-fer". */
const imageId = (landmark: Landmark) => `landmark-pin-${landmark.id}`

/**
 * useLandmarkLayer
 *
 * Renders the five STATIC reference points from `~/utils/landmarks` as two
 * dedicated MapLibre layers:
 *   • "landmark-pins"   — one badge-style pin per landmark, each with its
 *                         own accent color and glyph (helmet, train,
 *                         portico, ball, tram)
 *   • "landmark-labels" — landmark name under the pin, from zoom ≥ 11
 *
 * The data is a constant list, so unlike useBusStopLayer there are no
 * stores and no watchers: attach() builds everything once, detach() only
 * releases the map reference (a style swap wipes the layers for us).
 *
 * Follows the same attach/detach lifecycle as the other map layer
 * composables so MapView can rebuild it after a theme change.
 */
export function useLandmarkLayer() {
  let map: maplibregl.Map | null = null

  async function registerIcons() {
    for (const landmark of LANDMARKS) {
      if (!map || map.hasImage(imageId(landmark))) continue
      const data = await svgToImageData(
        generateLandmarkPinSvg(landmark),
        LANDMARK_PIN_W, LANDMARK_PIN_H,
      )
      // Re-check: an await above may have raced a detach or another attach.
      if (map && !map.hasImage(imageId(landmark)))
        map.addImage(imageId(landmark), data, { pixelRatio: 2 })
    }
  }

  function buildLandmarkCollection(): FeatureCollection<Point> {
    return {
      type: 'FeatureCollection',
      features: LANDMARKS.map((landmark): Feature<Point> => ({
        type: 'Feature',
        properties: { id: landmark.id, name: landmark.name },
        geometry: { type: 'Point', coordinates: landmark.coordinates },
      })),
    }
  }

  async function attach(
    mapInstance: maplibregl.Map,
    isDark = false,
    prefersReducedMotion?: Ref<boolean>,
  ) {
    // Idempotence guard: bail if this style already has our source — the
    // initial 'load' handler can race the debounced theme reload.
    if (mapInstance.getSource(SOURCE)) return
    map = mapInstance

    // Register icons asynchronously (SVG → Blob → Image → canvas → ImageData)
    await registerIcons()
    // Guard: component may have unmounted, or a concurrent attach may have
    // added the source, while we were awaiting the icon rendering.
    if (!map || map.getSource(SOURCE)) return

    map.addSource(SOURCE, {
      type: 'geojson',
      data: buildLandmarkCollection(),
    })

    // ── Layer 1: badge pins ────────────────────────────────────────────
    // Only five pins exist, so they stay visible at every zoom level to
    // serve as constant orientation anchors.
    map.addLayer({
      id: ICON_LAYER,
      type: 'symbol',
      source: SOURCE,
      layout: {
        // "landmark-pin-" + feature id → the image registered above
        'icon-image': ['concat', 'landmark-pin-', ['get', 'id']],
        // Anchor at the tail tip so the pin points at the exact location
        'icon-anchor': 'bottom',
        'icon-size': [
          'interpolate', ['linear'], ['zoom'],
          9, 0.5,
          12, 0.72,
          15, 0.9,
        ],
        // Never claim collision space (same rule as the stop layers) so
        // landmarks can never evict base-map labels underneath them.
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-rotation-alignment': 'viewport',
        'icon-pitch-alignment': 'viewport',
      },
    })

    // ── Layer 2: landmark name labels (theme-aware) ────────────────────
    map.addLayer({
      id: LABEL_LAYER,
      type: 'symbol',
      source: SOURCE,
      minzoom: 11,
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 11,
        'text-offset': [0, 0.4],
        'text-anchor': 'top',
        'text-max-width': 8,
        'text-font': ['Noto Sans Regular'],
        'text-allow-overlap': false,
        'text-optional': true,
      },
      paint: {
        'text-color': isDark ? '#e3e6ef' : '#1a1a1a',
        'text-halo-color': isDark ? '#0e0f11' : '#ffffff',
        'text-halo-width': 1.5,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0, 12, 1],
      },
    })

    // ── Interactions ────────────────────────────────────────────────
    // Clicking a pin flies the camera to the landmark and centers it at
    // street level. If the user is already zoomed in further, we keep
    // their zoom and only re-center.
    map.on('click', ICON_LAYER, (event) => {
      const id = event.features?.[0]?.properties?.id
      const landmark = LANDMARKS.find(item => item.id === id)
      if (!landmark || !map) return
      map.flyTo({
        center: landmark.coordinates,
        zoom: Math.max(map.getZoom(), LANDMARK_FOCUS_ZOOM),
        animate: !prefersReducedMotion?.value,
      })
    })
    map.on('mouseenter', ICON_LAYER, () => { map!.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', ICON_LAYER, () => { map!.getCanvas().style.cursor = '' })
  }

  function detach() {
    // No watchers or event listeners to clean up: the data is static.
    map = null
  }

  return { attach, detach }
}
