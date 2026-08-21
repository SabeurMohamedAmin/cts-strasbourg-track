import type maplibregl from 'maplibre-gl'
import type { Feature, FeatureCollection, Point } from 'geojson'
import { useStopsStore } from '~/stores/stops'
import { useLinesStore } from '~/stores/lines'
import { generateStopPinSvg, svgToImageData } from '~/utils/markerGenerator'
import { isLandmarkClick } from '~/utils/landmarks'

const BUS_STOP_ICON     = 'cts-bus-stop-pin'
const BUS_STOP_FAV_ICON = 'cts-bus-stop-pin-fav'

// SVG canvas dimensions (match the viewBox in generateStopPinSvg)
const PIN_W = 20
const PIN_H = 24

/**
 * Static size multiplier for BUS stop icons (bus only).
 * 1 = current design size — raise/lower to scale every bus pin at once.
 * Later this can move to the .env file via `runtimeConfig.public` if needed.
 */
const BUS_ICON_SIZE = 1

/**
 * useBusStopLayer
 *
 * Manages three dedicated MapLibre layers for BUS stations:
 *   • "bus-stop-circles"       — SVG teardrop pin icon per stop, zoom-adaptive
 *   • "bus-stop-labels"        — stop name, visible from zoom ≥ 14
 *   • "bus-stop-selected-ring" — selection ring on the selected stop
 *
 * Icons are rendered from the shared `generateStopPinSvg` utility so the bus
 * pin style matches the screenshot aesthetic exactly (teardrop pin pointing
 * down, white inner badge, transit icon inside).
 *
 * Icons fade in from hidden at z11 to full size at z15,
 * keeping the map uncluttered at city-level zoom.
 * Labels are theme-aware (white on dark maps, dark on light maps).
 */
export function useBusStopLayer() {
  const stopsStore = useStopsStore()
  const linesStore = useLinesStore()

  const stationsVisible = ref(true)

  let map: maplibregl.Map | null = null
  let isDarkMode = false
  let stopWatchingVisible: (() => void) | null = null
  let stopWatchingStops: (() => void) | null = null
  let stopWatchingSelected: (() => void) | null = null

  const SOURCE    = 'bus-stops'
  const ICON_LAYER  = 'bus-stop-circles'      // id kept for back-compat with toggle logic
  const LABEL_LAYER = 'bus-stop-labels'
  const RING_LAYER  = 'bus-stop-selected-ring'

  async function registerIcons() {
    if (!map) return

    if (!map.hasImage(BUS_STOP_ICON)) {
      const data = await svgToImageData(
        generateStopPinSvg('#0d47a1', 'bus', false),
        PIN_W, PIN_H,
      )
      if (map && !map.hasImage(BUS_STOP_ICON))
        map.addImage(BUS_STOP_ICON, data, { pixelRatio: 2 })
    }

    if (!map.hasImage(BUS_STOP_FAV_ICON)) {
      const data = await svgToImageData(
        generateStopPinSvg('#b45309', 'bus', false),
        PIN_W, PIN_H,
      )
      if (map && !map.hasImage(BUS_STOP_FAV_ICON))
        map.addImage(BUS_STOP_FAV_ICON, data, { pixelRatio: 2 })
    }
  }

  function buildBusStopCollection(): FeatureCollection<Point> {
    return {
      type: 'FeatureCollection',
      features: stopsStore.stops
        .filter(stop => stop.modes.includes('bus'))
        .map((stop): Feature<Point> => ({
          type: 'Feature',
          properties: {
            id: stop.stopId,
            name: stop.stopName,
            favourite: stopsStore.favoriteStops.some(f => f.stopId === stop.stopId),
          },
          geometry: { type: 'Point', coordinates: [stop.stopLon, stop.stopLat] },
        })),
    }
  }

  function updateSource() {
    if (!map?.isStyleLoaded()) return
    const source = map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined
    source?.setData(buildBusStopCollection())
  }

  function applyVisibility(visible: boolean) {
    if (!map) return
    const v = visible ? 'visible' : 'none'
    for (const layerId of [ICON_LAYER, LABEL_LAYER, RING_LAYER]) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', v)
    }
  }

  async function attach(mapInstance: maplibregl.Map, isDark = false) {
    // Idempotence guard: bail if this style already has our source — the
    // initial 'load' handler can race the debounced theme reload (see
    // useVehicleLayer.attach for the full story).
    if (mapInstance.getSource(SOURCE)) return
    // Detach any watchers left over from a previous attach so they never stack.
    if (map) detach()

    map = mapInstance
    isDarkMode = isDark

    // Register icons asynchronously (SVG → Blob → Image → canvas → ImageData)
    await registerIcons()
    // Guard: component may have unmounted, or a concurrent attach may have
    // added the source, while we were awaiting the icon rendering.
    if (!map || map.getSource(SOURCE)) return

    map.addSource(SOURCE, {
      type: 'geojson',
      data: buildBusStopCollection(),
      // Feature-state (focus-stations-area) needs a feature id:
      // promote the stop id from the properties.
      promoteId: 'id',
    })

    // ── Layer 1: SVG teardrop pin icon ─────────────────────────────────────
    // Anchored at 'bottom' so the pin tip points exactly at the stop coords.
    map.addLayer({
      id: ICON_LAYER,
      type: 'symbol',
      source: SOURCE,
      layout: {
        'icon-image': [
          'case',
          ['get', 'favourite'],
          BUS_STOP_FAV_ICON,
          BUS_STOP_ICON,
        ],
        // Anchor at the bottom tip of the teardrop so the pin points at the stop
        'icon-anchor': 'bottom',
        // Grow from tiny at low zoom to full size at street level,
        // scaled by BUS_ICON_SIZE (static, tweak at the top of this file).
        // The focus-stations-area effect is TRAM-only: bus pins never shrink.
        'icon-size': [
          'interpolate', ['linear'], ['zoom'],
          11, 0.28 * BUS_ICON_SIZE,
          13, 0.48 * BUS_ICON_SIZE,
          15, 0.72 * BUS_ICON_SIZE,
          17, 0.88 * BUS_ICON_SIZE,
        ],
        // Match the tram layer: pins never claim collision space, so they
        // can NEVER evict base-map labels (city names) underneath them.
        // Without this, toggling the bus layer on made city names vanish.
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-rotation-alignment': 'viewport',
        'icon-pitch-alignment': 'viewport',
        visibility: stationsVisible.value ? 'visible' : 'none',
      },
      paint: {
        // Simple zoom fade-in. The focus-stations-area effect is TRAM-only,
        // so bus pins keep full opacity everywhere on screen.
        'icon-opacity': [
          'interpolate', ['linear'], ['zoom'],
          11, 0.0,
          12, 0.55,
          13, 1.0,
        ],
      },
    })

    // ── Layer 2: stop name labels (theme-aware) ───────────────────────────
    map.addLayer({
      id: LABEL_LAYER,
      type: 'symbol',
      source: SOURCE,
      minzoom: 14,
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 10,
        'text-offset': [0, 1.6],
        'text-anchor': 'top',
        'text-max-width': 8,
        'text-font': ['Noto Sans Regular'],
        'text-allow-overlap': false,
        'text-optional': true,
        visibility: stationsVisible.value ? 'visible' : 'none',
      },
      paint: {
        'text-color': isDarkMode ? '#d0d4e0' : '#1a1a1a',
        'text-halo-color': isDarkMode ? '#0e0f11' : '#ffffff',
        'text-halo-width': 1.5,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, 1],
      },
    })

    // ── Layer 3: selection ring ───────────────────────────────────────────
    map.addLayer({
      id: RING_LAYER,
      type: 'circle',
      source: SOURCE,
      filter: ['==', ['get', 'id'], ''],
      paint: {
        'circle-color': 'transparent',
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 10, 16, 16],
        'circle-stroke-color': '#42a5f5',
        'circle-stroke-width': 2.5,
        'circle-stroke-opacity': 0.85,
      },
      layout: { visibility: stationsVisible.value ? 'visible' : 'none' },
    })

    // ── Interactions ──────────────────────────────────────────────────
    map.on('click', ICON_LAYER, (event) => {
      // A landmark pin on top of this stop owns the click (zoom + center only)
      if (isLandmarkClick(event.target, event.point)) return
      const id = event.features?.[0]?.properties?.id
      if (typeof id === 'string') stopsStore.selectStop(id)
    })
    map.on('contextmenu', ICON_LAYER, (event) => {
      event.preventDefault()
      if (isLandmarkClick(event.target, event.point)) return
      const id = event.features?.[0]?.properties?.id
      if (typeof id !== 'string') return
      const stop = stopsStore.stops.find(item => item.stopId === id)
      const firstRoute = stop?.routes.find(routeId =>
        linesStore.lines.find(line => line.routeId === routeId)?.routeType === 3,
      )
      stopsStore.selectStop(id)
      if (firstRoute) linesStore.setLineVisible(firstRoute, true)
    })
    for (const cursor of [ICON_LAYER]) {
      map.on('mouseenter', cursor, () => { map!.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', cursor, () => { map!.getCanvas().style.cursor = '' })
    }

    // ── Reactive watchers ──────────────────────────────────────────────
    stopWatchingStops = watch(
      [() => stopsStore.stops, () => stopsStore.favoriteStops],
      updateSource,
      { deep: true },
    )
    stopWatchingVisible = watch(stationsVisible, applyVisibility)
    stopWatchingSelected = watch(
      () => stopsStore.selectedStopId,
      (stopId) => {
        if (!map?.isStyleLoaded()) return
        map.setFilter(RING_LAYER, ['==', ['get', 'id'], stopId ?? ''])
      },
    )
  }

  function detach() {
    stopWatchingVisible?.()
    stopWatchingStops?.()
    stopWatchingSelected?.()
    stopWatchingVisible = null
    stopWatchingStops = null
    stopWatchingSelected = null
    map = null
  }

  return { attach, detach, stationsVisible }
}
