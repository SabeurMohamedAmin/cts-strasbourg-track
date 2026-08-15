import type maplibregl from 'maplibre-gl'
import type { ShallowRef } from 'vue'
import { useStopsStore } from '~/stores/stops'
import { useMapStore } from '~/stores/map'

// ── Tuning constants ────────────────────────────────────────────────
/** Circle diameter as a fraction of the smaller viewport side (40%). */
const FOCUS_DIAMETER_RATIO = 0.5
/** Station icon opacity inside the focus circle (80%). */
const FOCUS_INNER_OPACITY = 0.8
/** Station icon opacity outside the focus circle. */
const FOCUS_OUTER_OPACITY = 0.12
/** Station icon scale outside the focus circle (half size). */
const FOCUS_OUTER_SCALE = 0.5
/** Scale quantization step: sources only rebuild when a stop crosses a step. */
const FOCUS_SCALE_STEP = 0.1
/** Minimum delay between two focus-scale writes to the map store. */
const FOCUS_SCALE_WRITE_MS = 150
/** Icons start fading at this fraction of the radius (radial gradient). */
const FOCUS_FADE_START = 0.5
/**
 * GeoJSON sources whose features receive the focusOpacity feature-state.
 * TRAM-ONLY by design: bus stops keep full size/opacity everywhere.
 */
const FOCUS_SOURCES = ['tram-stops'] as const
/** Ignore opacity changes smaller than this to avoid useless repaints. */
const OPACITY_EPSILON = 0.01

/**
 * useFocusStationsArea
 *
 * Implements the "focus-stations-area": a circular spotlight, 40% of the
 * screen, centered on the screen by default and following the pointer on
 * hover / click / touch.
 *
 * Two halves work together:
 *   1. A visual overlay (`overlayStyle`, consumed by MapView) — a radial
 *      gradient that is solid until 30% of the radius, then fades out.
 *   2. Station icon opacity — every TRAM stop gets a `focusOpacity`
 *      feature-state: 0.8 inside the circle, 0.12 outside, with a linear
 *      ramp between 70% and 100% of the radius. The stop layers multiply
 *      this value into their `icon-opacity` paint expression.
 *
 * Feature-state is the MapLibre-native way to change per-feature paint
 * values without rebuilding the GeoJSON sources on every mouse move.
 */
export function useFocusStationsArea(map: ShallowRef<maplibregl.Map | undefined>) {
  const stopsStore = useStopsStore()
  const mapStore = useMapStore()

  // Container size + pointer position, in CSS pixels relative to the map.
  const containerWidth = ref(0)
  const containerHeight = ref(0)
  const pointerX = ref<number | null>(null) // null = default (screen center)
  const pointerY = ref<number | null>(null)

  const focusDiameter = computed(
    () => Math.min(containerWidth.value, containerHeight.value) * FOCUS_DIAMETER_RATIO,
  )
  const focusRadius = computed(() => focusDiameter.value / 2)
  const centerX = computed(() => pointerX.value ?? containerWidth.value / 2)
  const centerY = computed(() => pointerY.value ?? containerHeight.value / 2)

  /** Inline style for the visual overlay div rendered by MapView. */
  const overlayStyle = computed(() => ({
    width: `${focusDiameter.value}px`,
    height: `${focusDiameter.value}px`,
    left: `${centerX.value - focusRadius.value}px`,
    top: `${centerY.value - focusRadius.value}px`,
  }))

  // ── Feature-state updates ──────────────────────────────────────────
  // Last opacity written per stop: skipping unchanged writes keeps the
  // 'idle' → refresh → repaint cycle from looping forever.
  const lastOpacity = new Map<string, number>()
  let frame = 0

  /** rAF-deduped: many events can fire per frame, we only compute once. */
  function scheduleRefresh() {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      applyFocusToStations()
    })
  }

  // ── Icon scale (via the map store) ────────────────────────────────
  // icon-size is a LAYOUT property: MapLibre forbids feature-state there,
  // so the scale factor travels through the GeoJSON properties instead.
  // Rebuilding the sources is heavier than feature-state, hence the
  // throttle + quantization.
  let lastScaleWrite = 0
  let scaleRetryTimer: ReturnType<typeof setTimeout> | null = null

  function scalesChanged(next: Record<string, number>): boolean {
    const current = mapStore.stopFocusScale
    const keys = Object.keys(next)
    if (keys.length !== Object.keys(current).length) return true
    return keys.some(key => next[key] !== current[key])
  }

  function maybeWriteScales(scales: Record<string, number>) {
    if (!scalesChanged(scales)) return
    const now = Date.now()
    if (now - lastScaleWrite >= FOCUS_SCALE_WRITE_MS) {
      lastScaleWrite = now
      mapStore.setStopFocusScales(scales)
    }
    else if (!scaleRetryTimer) {
      // Trailing retry so icons settle at the final pointer position.
      scaleRetryTimer = setTimeout(() => {
        scaleRetryTimer = null
        scheduleRefresh()
      }, FOCUS_SCALE_WRITE_MS)
    }
  }

  function applyFocusToStations() {
    const m = map.value
    if (!m || !m.isStyleLoaded() || focusRadius.value <= 0) return
    const scales: Record<string, number> = {}
    for (const stop of stopsStore.stops) {
      // Focus effect is TRAM-only: bus stops keep full size and opacity.
      if (!stop.modes.includes('tram')) continue
      // Screen-space distance from the stop to the focus center,
      // normalized so 1 = exactly on the circle edge.
      const point = m.project([stop.stopLon, stop.stopLat])
      const distance = Math.hypot(point.x - centerX.value, point.y - centerY.value) / focusRadius.value
      // 0 before the fade starts, 1 past the circle edge.
      const fade = Math.min(Math.max((distance - FOCUS_FADE_START) / (1 - FOCUS_FADE_START), 0), 1)

      // Icon scale: 1 inside the circle, 0.5 outside, quantized to 0.1
      // steps so sources only rebuild when a stop visibly changes size.
      const scale = 1 + (FOCUS_OUTER_SCALE - 1) * fade
      scales[stop.stopId] = Math.round(scale / FOCUS_SCALE_STEP) * FOCUS_SCALE_STEP

      const opacity = FOCUS_INNER_OPACITY + (FOCUS_OUTER_OPACITY - FOCUS_INNER_OPACITY) * fade
      if (Math.abs((lastOpacity.get(stop.stopId) ?? -1) - opacity) < OPACITY_EPSILON) continue
      lastOpacity.set(stop.stopId, opacity)
      for (const source of FOCUS_SOURCES) {
        if (m.getSource(source))
          m.setFeatureState({ source, id: stop.stopId }, { focusOpacity: opacity })
      }
    }
    maybeWriteScales(scales)
  }

  // ── Pointer / map event bindings ────────────────────────────────────
  function readContainerSize() {
    const container = map.value?.getContainer()
    if (!container) return
    containerWidth.value = container.clientWidth
    containerHeight.value = container.clientHeight
  }

  function setFocusFromClient(clientX: number, clientY: number) {
    const container = map.value?.getContainer()
    if (!container) return
    const rect = container.getBoundingClientRect()
    pointerX.value = clientX - rect.left
    pointerY.value = clientY - rect.top
    scheduleRefresh()
  }

  const onMouseMove = (event: MouseEvent) => setFocusFromClient(event.clientX, event.clientY)
  const onClick = (event: MouseEvent) => setFocusFromClient(event.clientX, event.clientY)
  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches.item(0)
    if (touch) setFocusFromClient(touch.clientX, touch.clientY)
  }
  const onResize = () => {
    readContainerSize()
    scheduleRefresh()
  }
  // A style swap creates new sources with cleared feature-states: forget
  // the cache so every stop gets written again once the new layers are up.
  const onStyleData = () => {
    lastOpacity.clear()
    scheduleRefresh()
  }

  let boundContainer: HTMLElement | null = null

  const stopWatchingMap = watch(map, (m) => {
    if (!m || boundContainer) return
    boundContainer = m.getContainer()
    readContainerSize()
    boundContainer.addEventListener('mousemove', onMouseMove)
    boundContainer.addEventListener('click', onClick)
    boundContainer.addEventListener('touchstart', onTouchStart, { passive: true })
    m.on('move', scheduleRefresh) // stops move on screen while panning/zooming
    m.on('resize', onResize)
    m.on('idle', scheduleRefresh) // catches sources (re)loaded after attach
    m.on('styledata', onStyleData) // theme swap wipes feature-states
    scheduleRefresh()
  }, { immediate: true })

  // The stops list can arrive after the map: refresh once it is filled.
  const stopWatchingStops = watch(() => stopsStore.stops, scheduleRefresh)

  onUnmounted(() => {
    stopWatchingMap()
    stopWatchingStops()
    if (frame) cancelAnimationFrame(frame)
    if (scaleRetryTimer) clearTimeout(scaleRetryTimer)
    boundContainer?.removeEventListener('mousemove', onMouseMove)
    boundContainer?.removeEventListener('click', onClick)
    boundContainer?.removeEventListener('touchstart', onTouchStart)
    boundContainer = null
    // Map listeners die with the map instance (removed by useMapInstance).
  })

  return { overlayStyle, focusDiameter, refresh: scheduleRefresh }
}
