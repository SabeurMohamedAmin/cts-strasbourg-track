/**
 * useMapFraming (Step 2.2)
 *
 * Owns everything about "where the camera is allowed to be":
 *   - the responsive Eurométropole frame (mobile vs desktop breakpoint)
 *   - fitEurometropole() / recenter() — the two-guard framing logic
 *   - the breakpoint watcher that re-applies the frame on resize / rotation
 *   - the user's prefers-reduced-motion accessibility setting
 *
 * Two guards enforce the frame strictly:
 *   Guard 1 (maxBounds, set on the Map constructor and kept in sync by the
 *   breakpoint watcher) — engine-level pan lock; the viewport center can
 *   NEVER leave the bbox.
 *   Guard 2 (minZoom, locked in fitEurometropole) — zoom-out lock; the user
 *   cannot zoom out past the full-frame view.
 * Together they keep the map fully imprisoned in the validated frame.
 */
import type maplibregl from 'maplibre-gl'
import type { ShallowRef } from 'vue'
import { useDisplay } from 'vuetify'
import {
  ABSOLUTE_MIN_ZOOM,
  CITY_FOCUS_ZOOM_OFFSET,
  STRASBOURG_CENTER,
  boundsForBreakpoint,
  type BoundsTuple,
} from '~/utils/map-constants'

export function useMapFraming(map: ShallowRef<maplibregl.Map | undefined>) {
  const { mdAndDown } = useDisplay()

  /**
   * Reactive Eurométropole frame — recomputed whenever the breakpoint changes.
   *
   * An earlier version read `mdAndDown.value` ONCE at setup time, so the
   * bounds were frozen with whatever breakpoint was active on first render
   * (often the SSR default) and never updated on resize or device rotation.
   * A `computed` keeps it in sync; the watcher below applies it to the map.
   */
  const eurometropoleBounds = computed<BoundsTuple>(
    () => boundsForBreakpoint(mdAndDown.value),
  )

  // Respect the OS accessibility setting. Read on mount so SSR never touches
  // window; until then the ref stays false, which only affects animations.
  const prefersReducedMotion = ref(false)
  onMounted(() => {
    prefersReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  /**
   * Fit the map to the strict Eurométropole frame, lock minZoom,
   * then center Strasbourg city on screen.
   *
   * fitBounds always runs without animation so the zoom floor is computed
   * synchronously; only the final ease onto the city center is animated.
   */
  function fitEurometropole(animate = false) {
    const m = map.value
    if (!m) return
    // Relax the zoom floor first: a previous fit may have locked it higher
    // than what the (possibly new, wider) bounds require.
    m.setMinZoom(ABSOLUTE_MIN_ZOOM)
    m.fitBounds(eurometropoleBounds.value, { padding: 0, animate: false })
    // Guard 2: lock the zoom-out floor to exactly the zoom fitBounds computed.
    m.setMinZoom(m.getZoom())
    // Ease onto Strasbourg so the city sits in the middle of the screen.
    m.easeTo({
      center: STRASBOURG_CENTER,
      zoom: m.getZoom() + CITY_FOCUS_ZOOM_OFFSET,
      animate: animate && !prefersReducedMotion.value,
    })
  }

  /** FAB action: glide back to the Strasbourg-centered frame. */
  function recenter() { fitEurometropole(true) }

  // Breakpoint changed (resize / rotation): apply the new frame and refit.
  watch(eurometropoleBounds, (bounds) => {
    const m = map.value
    if (!m) return
    m.setMaxBounds(bounds) // Guard 1 follows the active breakpoint
    fitEurometropole(false)
  })

  return { eurometropoleBounds, prefersReducedMotion, fitEurometropole, recenter }
}
