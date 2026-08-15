import { useResizeObserver } from '@vueuse/core'
import type { Ref } from 'vue'

/**
 * Layout helper for StationRouteBar. Two things need JavaScript there:
 *
 * 1. Room for the labels. A label written at an angle overflows its box
 *    diagonally (up and to the right), and a horizontal scroller ALWAYS clips
 *    vertically: `overflow-y: visible` becomes `auto` as soon as one axis
 *    scrolls. Guessing a padding breaks on long station names, so we measure the
 *    widest label and reserve exactly what it needs, above (`labelSpace`) and
 *    after the last stop (`labelTail`).
 *
 * 2. Centering the current stop. `scrollIntoView()` scrolls every parent too,
 *    which made the whole page jump, so we move the track ourselves.
 *
 * These selectors must match the classes used in StationRouteBar.vue.
 */
const LABEL = '.stop__label'
const STOP = '.stop'
const CURRENT = '.stop--current'

/** Breathing room between a dot and the start of its label, in pixels. */
const LABEL_GAP = 6

/** Used on the server and until the first measurement, in pixels. */
const DEFAULT_LABEL_SPACE = 64
const DEFAULT_LABEL_TAIL = 8

/** Fallback width of one stop when the DOM cannot be read yet, in pixels. */
const DEFAULT_STOP_WIDTH = 72

export function useRouteBarLayout(track: Ref<HTMLElement | null>, angleDegrees: number) {
  const angle = (Math.abs(angleDegrees) * Math.PI) / 180

  const labelSpace = ref(DEFAULT_LABEL_SPACE)
  const labelTail = ref(DEFAULT_LABEL_TAIL)
  const canScrollBack = ref(false)
  const canScrollForward = ref(false)
  const isScrollable = computed(() => canScrollBack.value || canScrollForward.value)

  /** Width of one stop, read from the DOM so the CSS stays the only source. */
  function stopWidth(): number {
    return track.value?.querySelector<HTMLElement>(STOP)?.offsetWidth ?? DEFAULT_STOP_WIDTH
  }

  /** Reserves the room the rotated labels need, from the widest one. */
  function measureLabels() {
    const element = track.value
    if (!element) return

    let widest = 0
    let tallest = 14
    for (const label of element.querySelectorAll<HTMLElement>(LABEL)) {
      widest = Math.max(widest, label.offsetWidth)
      tallest = Math.max(tallest, label.offsetHeight)
    }

    // Size of a rotated box: width * sin(angle) + height * cos(angle).
    labelSpace.value = Math.ceil(widest * Math.sin(angle) + tallest * Math.cos(angle)) + LABEL_GAP

    // Labels lean to the right, so the last one needs room after the track.
    labelTail.value = Math.max(
      DEFAULT_LABEL_TAIL,
      Math.ceil(widest * Math.cos(angle) - stopWidth() / 2),
    )
  }

  /** Enables or disables the arrows for the current scroll position. */
  function refreshArrows() {
    const element = track.value
    if (!element) return

    const maxScroll = element.scrollWidth - element.clientWidth
    canScrollBack.value = element.scrollLeft > 1
    canScrollForward.value = element.scrollLeft < maxScroll - 1
  }

  /** Measure, let the browser apply the new padding, then read the sizes. */
  async function measure() {
    measureLabels()
    await nextTick()
    refreshArrows()
  }

  /** Readers who asked for less motion get an instant scroll. */
  function scrollBehavior(smooth: boolean): ScrollBehavior {
    if (!smooth) return 'auto'
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  }

  /** Brings the current stop to the middle of the track, page untouched. */
  function centerCurrent(smooth: boolean) {
    const element = track.value
    const current = element?.querySelector<HTMLElement>(CURRENT)
    if (!element || !current) return

    const left = current.offsetLeft - (element.clientWidth - current.offsetWidth) / 2
    element.scrollTo({ left: Math.max(0, left), behavior: scrollBehavior(smooth) })
  }

  /** Arrow buttons: one screenful of stops, never less than one stop. */
  function scrollStops(direction: 1 | -1) {
    const element = track.value
    if (!element) return

    const step = Math.max(stopWidth(), Math.round(element.clientWidth * 0.7))
    element.scrollBy({ left: direction * step, behavior: scrollBehavior(true) })
  }

  // The width of the bar decides whether the arrows are needed.
  useResizeObserver(track, () => { void measure() })

  // Custom fonts change the label widths: measure again once they are loaded.
  onMounted(() => { document.fonts?.ready.then(() => measure()) })

  return {
    labelSpace,
    labelTail,
    canScrollBack,
    canScrollForward,
    isScrollable,
    measure,
    refreshArrows,
    centerCurrent,
    scrollStops,
  }
}
