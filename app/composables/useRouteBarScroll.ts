import { useResizeObserver } from '@vueuse/core'
import type { Ref } from 'vue'

/**
 * Horizontal scrolling of StationRouteBar: the two arrows, and bringing the
 * current station to the middle of the bar.
 *
 * The track is scrolled directly. `scrollIntoView()` would also scroll every
 * parent, which made the whole page jump.
 */
export function useRouteBarScroll(track: Ref<HTMLElement | null>) {
  const canScrollBack = ref(false)
  const canScrollForward = ref(false)
  const isScrollable = computed(() => canScrollBack.value || canScrollForward.value)

  /** Enables or disables the arrows for the current scroll position. */
  function updateArrows() {
    const bar = track.value
    if (!bar) return

    canScrollBack.value = bar.scrollLeft > 1
    canScrollForward.value = bar.scrollLeft < bar.scrollWidth - bar.clientWidth - 1
  }

  /** Readers who asked for less motion get an instant scroll. */
  function scrollBehavior(smooth: boolean): ScrollBehavior {
    if (!smooth) return 'auto'
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  }

  /** Centers the stop marked `.stop--current`, if there is one. */
  function centerCurrent(smooth = true) {
    const bar = track.value
    const current = bar?.querySelector<HTMLElement>('.stop--current')
    if (!bar || !current) return

    const left = current.offsetLeft - (bar.clientWidth - current.offsetWidth) / 2
    bar.scrollTo({ left: Math.max(0, left), behavior: scrollBehavior(smooth) })
  }

  /** Arrow buttons: about one screenful of stops. */
  function scrollStops(direction: 1 | -1) {
    const bar = track.value
    if (!bar) return

    bar.scrollBy({ left: direction * Math.round(bar.clientWidth * 0.7), behavior: scrollBehavior(true) })
  }

  // Runs once when the observation starts, then on every width change.
  useResizeObserver(track, updateArrows)

  return {
    canScrollBack,
    canScrollForward,
    isScrollable,
    updateArrows,
    centerCurrent,
    scrollStops,
  }
}
