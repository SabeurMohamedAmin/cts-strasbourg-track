import type maplibregl from 'maplibre-gl'
import type { Feature, FeatureCollection, Point } from 'geojson'
import { useStopsStore } from '~/stores/stops'
import { useLinesStore } from '~/stores/lines'
import { useMapStore } from '~/stores/map'
import { isLandmarkClick } from '~/utils/landmarks'

const TRAM_STOP_ICON_PREFIX = 'cts-tram-stop-'
const TRAM_STOP_FAVORITE_SUFFIX = '-fav'

/**
 * Static size multiplier for TRAM stop icons (tram only).
 * 1 = current design size — raise/lower to scale every tram diamond at once.
 * Later this can move to the .env file via `runtimeConfig.public` if needed.
 */
const TRAM_ICON_SIZE = 1

/**
 * Draws an elegant diamond (rotated square) tram-stop marker on a canvas.
 *
 * Design language:
 *   ◆  Outer diamond filled with the line’s official color
 *   ◆  Thin white stroke around the diamond for contrast on any basemap
 *   ◆  Subtle glow via shadow matching the fill color
 *   ◆  Small white filled circle at the center (the “pole” metaphor)
 *
 * Visually distinct from the bus SVG teardrop pin at every zoom level.
 */
function buildTramStopIcon(fillColor: string, isFavourite = false): ImageData {
  const SIZE = 40
  const cx = SIZE / 2
  const cy = SIZE / 2
  const half = 14

  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!

  ctx.shadowColor = fillColor
  ctx.shadowBlur = 6

  ctx.beginPath()
  ctx.moveTo(cx, cy - half)
  ctx.lineTo(cx + half, cy)
  ctx.lineTo(cx, cy + half)
  ctx.lineTo(cx - half, cy)
  ctx.closePath()

  ctx.fillStyle = isFavourite ? '#f59e0b' : fillColor
  ctx.fill()

  ctx.shadowBlur = 0
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 2.5
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(cx, cy, 4, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  return ctx.getImageData(0, 0, SIZE, SIZE)
}

/**
 * useTramStopLayer
 *
 * Manages three dedicated MapLibre layers for TRAM stations:
 *   • "tram-stop-circles"       — elegant diamond canvas icon per stop
 *   • "tram-stop-labels"        — stop name, visible from zoom ≥ 13
 *   • "tram-stop-selected-ring" — selection ring on the selected stop
 *
 * Each stop’s diamond color matches its dominant tram line color.
 * Labels are theme-aware (white on dark maps, dark on light maps).
 */
export function useTramStopLayer() {
  const stopsStore = useStopsStore()
  const linesStore = useLinesStore()
  const mapStore = useMapStore()

  const stationsVisible = ref(true)

  let map: maplibregl.Map | null = null
  let isDarkMode = false
  let stopWatchingVisible: (() => void) | null = null
  let stopWatchingStops: (() => void) | null = null
  let stopWatchingSelected: (() => void) | null = null

  const SOURCE = 'tram-stops'
  const CIRCLE_LAYER = 'tram-stop-circles'
  const LABEL_LAYER = 'tram-stop-labels'
  const RING_LAYER = 'tram-stop-selected-ring'

  function dominantColor(stop: { routes: string[] }): string {
    for (const routeId of stop.routes) {
      const line = linesStore.lines.find(l => l.routeId === routeId && l.routeType === 0)
      if (line?.routeColor) return line.routeColor
    }
    return 'c8102e'
  }

  function registerIcons() {
    if (!map) return
    const colors = new Set<string>()
    for (const stop of stopsStore.stops.filter(s => s.modes.includes('tram'))) {
      colors.add(dominantColor(stop))
    }
    for (const color of colors) {
      const normal = `${TRAM_STOP_ICON_PREFIX}${color}`
      const fav = `${normal}${TRAM_STOP_FAVORITE_SUFFIX}`
      if (!map.hasImage(normal))
        map.addImage(normal, buildTramStopIcon(`#${color}`, false), { pixelRatio: 2 })
      if (!map.hasImage(fav))
        map.addImage(fav, buildTramStopIcon(`#${color}`, true), { pixelRatio: 2 })
    }
  }

  function buildTramStopCollection(): FeatureCollection<Point> {
    return {
      type: 'FeatureCollection',
      features: stopsStore.stops
        .filter(stop => stop.modes.includes('tram'))
        .map((stop): Feature<Point> => ({
          type: 'Feature',
          properties: {
            id: stop.stopId,
            name: stop.stopName,
            favourite: stopsStore.favoriteStops.some(f => f.stopId === stop.stopId),
            lineColor: dominantColor(stop),
            // focus-stations-area size factor (1 inside, 0.5 outside)
            focusScale: mapStore.stopFocusScale[stop.stopId] ?? 1,
          },
          geometry: { type: 'Point', coordinates: [stop.stopLon, stop.stopLat] },
        })),
    }
  }

  function updateSource() {
    if (!map?.isStyleLoaded()) return
    const source = map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined
    source?.setData(buildTramStopCollection())
  }

  function applyVisibility(visible: boolean) {
    if (!map) return
    const v = visible ? 'visible' : 'none'
    for (const layerId of [CIRCLE_LAYER, LABEL_LAYER, RING_LAYER]) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', v)
    }
  }

  function attach(mapInstance: maplibregl.Map, isDark = false) {
    // Idempotence guard: bail if this style already has our source — the
    // initial 'load' handler can race the debounced theme reload (see
    // useVehicleLayer.attach for the full story).
    if (mapInstance.getSource(SOURCE)) return
    // Detach any watchers left over from a previous attach so they never stack.
    if (map) detach()

    map = mapInstance
    isDarkMode = isDark

    registerIcons()

    map.addSource(SOURCE, {
      type: 'geojson',
      data: buildTramStopCollection(),
      // Feature-state (focus-stations-area) needs a feature id:
      // promote the stop id from the properties.
      promoteId: 'id',
    })

    // ── Layer 1: diamond icon per stop ────────────────────────────────────
    map.addLayer({
      id: CIRCLE_LAYER,
      type: 'symbol',
      source: SOURCE,
      layout: {
        'icon-image': [
          'case',
          ['get', 'favourite'],
          ['concat', TRAM_STOP_ICON_PREFIX, ['get', 'lineColor'], TRAM_STOP_FAVORITE_SUFFIX],
          ['concat', TRAM_STOP_ICON_PREFIX, ['get', 'lineColor']],
        ],
        // Zoom growth × TRAM_ICON_SIZE (static, tweak at the top of this
        // file) × the focus-stations-area factor (half size outside the
        // focus circle — the focus effect only applies to tram stations).
        'icon-size': [
          'interpolate', ['linear'], ['zoom'],
          10, ['*', 0.45 * TRAM_ICON_SIZE, ['get', 'focusScale']],
          13, ['*', 0.72 * TRAM_ICON_SIZE, ['get', 'focusScale']],
          16, ['*', 1.1 * TRAM_ICON_SIZE, ['get', 'focusScale']],
        ],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        visibility: stationsVisible.value ? 'visible' : 'none',
      },
      paint: {
        // Zoom fade-in multiplied by the focus-stations-area factor
        // (feature-state written by useFocusStationsArea: 0.8 inside the
        // focus circle, 0.2 outside, radial gradient from 70% of it).
        // MapLibre only allows ['zoom'] inside a TOP-LEVEL interpolate,
        // so the multiplication lives inside each interpolation output.
        'icon-opacity': [
          'interpolate', ['linear'], ['zoom'],
          10, ['*', 0.5, ['coalesce', ['feature-state', 'focusOpacity'], 1]],
          12, ['*', 1.0, ['coalesce', ['feature-state', 'focusOpacity'], 1]],
        ],
      },
    })

    // ── Layer 2: stop name labels (theme-aware) ───────────────────────────
    map.addLayer({
      id: LABEL_LAYER,
      type: 'symbol',
      source: SOURCE,
      minzoom: 13,
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 11,
        'text-offset': [0, 1.5],
        'text-anchor': 'top',
        'text-max-width': 8,
        'text-font': ['Noto Sans Regular'],
        'text-allow-overlap': false,
        'text-optional': true,
        visibility: stationsVisible.value ? 'visible' : 'none',
      },
      paint: {
        'text-color': isDarkMode ? '#e8eaf0' : '#1a1a1a',
        'text-halo-color': isDarkMode ? '#0e0f11' : '#ffffff',
        'text-halo-width': 1.5,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, 1],
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
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 11, 16, 18],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
        'circle-stroke-opacity': 0.85,
      },
      layout: { visibility: stationsVisible.value ? 'visible' : 'none' },
    })

    map.on('click', CIRCLE_LAYER, (event) => {
      // A landmark pin on top of this stop owns the click (zoom + center only)
      if (isLandmarkClick(event.target, event.point)) return
      const id = event.features?.[0]?.properties?.id
      if (typeof id === 'string') stopsStore.selectStop(id)
    })
    map.on('contextmenu', CIRCLE_LAYER, (event) => {
      event.preventDefault()
      if (isLandmarkClick(event.target, event.point)) return
      const id = event.features?.[0]?.properties?.id
      if (typeof id !== 'string') return
      const stop = stopsStore.stops.find(item => item.stopId === id)
      const firstRoute = stop?.routes.find(routeId =>
        linesStore.lines.find(line => line.routeId === routeId)?.routeType === 0,
      )
      stopsStore.selectStop(id)
      if (firstRoute) linesStore.setLineVisible(firstRoute, true)
    })
    for (const cursor of [CIRCLE_LAYER]) {
      map.on('mouseenter', cursor, () => { map!.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', cursor, () => { map!.getCanvas().style.cursor = '' })
    }

    stopWatchingStops = watch(
      [() => stopsStore.stops, () => stopsStore.favoriteStops, () => mapStore.stopFocusScale],
      () => { registerIcons(); updateSource() },
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
