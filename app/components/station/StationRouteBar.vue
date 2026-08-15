<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'

/**
 * Horizontal "route bar": every stop of the selected line/direction, with its
 * name written at -35° above a connecting line.
 *
 * Why this component needs JavaScript:
 * a rotated label overflows its own box diagonally (up AND to the right), and a
 * horizontal scroller can never keep `overflow-y: visible` (CSS forces it to
 * `auto` as soon as one axis scrolls). So instead of guessing a padding, we
 * measure the widest label and reserve exactly the room it needs:
 *   --label-space -> above the line   --label-tail -> after the last stop
 */

interface RouteBarStop {
  name: string
  /** No slug = stop without a page: rendered as plain text. */
  slug?: string
  isCurrent?: boolean
}

const props = defineProps<{
  stops: RouteBarStop[]
  /** Line brand color, hex WITHOUT the leading '#'. */
  lineColor?: string
}>()

const NuxtLink = resolveComponent('NuxtLink')

/** Label angle. Every measurement below is derived from it. */
const ROTATION = -35
const RADIANS = (Math.abs(ROTATION) * Math.PI) / 180
/** Safety margin added on top of the measured label height. */
const LABEL_OFFSET = 6

const trackRef = ref<HTMLElement | null>(null)

/** Room reserved for the rotated labels (px). Defaults cover SSR / no-JS. */
const labelSpace = ref(64)
const labelTail = ref(8)

const canScrollBack = ref(false)
const canScrollForward = ref(false)
const isScrollable = computed(() => canScrollBack.value || canScrollForward.value)

/** Brand color of the line, falling back to the theme accent. */
const accent = computed(() =>
  props.lineColor ? `#${props.lineColor.replace('#', '')}` : 'rgb(var(--v-theme-error))',
)

/**
 * Signature of the list: the parent may hand over a new array on every render,
 * so we only re-measure and re-center when the content actually changed.
 */
const stopsKey = computed(() =>
  props.stops.map(stop => `${stop.slug ?? stop.name}${stop.isCurrent ? '*' : ''}`).join('|'),
)

/** Measures the widest label, then reserves the space it needs once rotated. */
function measureLabels() {
  const track = trackRef.value
  if (!track) return

  let widest = 0
  let tallest = 14
  for (const label of track.querySelectorAll<HTMLElement>('.stop__label')) {
    widest = Math.max(widest, label.offsetWidth)
    tallest = Math.max(tallest, label.offsetHeight)
  }

  // Height of a rotated box = width * sin(angle) + height * cos(angle).
  labelSpace.value = Math.ceil(widest * Math.sin(RADIANS) + tallest * Math.cos(RADIANS)) + LABEL_OFFSET

  // The label leans to the right, so the last one needs room after the track.
  const pitch = track.querySelector<HTMLElement>('.stop')?.offsetWidth ?? 72
  labelTail.value = Math.max(8, Math.ceil(widest * Math.cos(RADIANS) - pitch / 2))
}

/** Keeps the arrows in sync with the real scroll position. */
function updateArrows() {
  const track = trackRef.value
  if (!track) return
  const maxScroll = track.scrollWidth - track.clientWidth
  canScrollBack.value = track.scrollLeft > 1
  canScrollForward.value = track.scrollLeft < maxScroll - 1
}

/** Measure first, let the browser apply the new padding, then read the sizes. */
async function refresh() {
  measureLabels()
  await nextTick()
  updateArrows()
}

function scrollBehavior(smooth: boolean): ScrollBehavior {
  if (!smooth) return 'auto'
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

/**
 * Centers the current stop by moving the track itself. `scrollIntoView()` would
 * also scroll every parent, which made the whole page jump on mount.
 */
function centerCurrent(smooth: boolean) {
  const track = trackRef.value
  const current = track?.querySelector<HTMLElement>('.stop--current')
  if (!track || !current) return

  const left = current.offsetLeft - (track.clientWidth - current.offsetWidth) / 2
  track.scrollTo({ left: Math.max(0, left), behavior: scrollBehavior(smooth) })
}

/** Arrow buttons: one "page" of stops, never less than one stop. */
function scrollStops(direction: 1 | -1) {
  const track = trackRef.value
  if (!track) return
  const pitch = track.querySelector<HTMLElement>('.stop')?.offsetWidth ?? 72
  const step = Math.max(pitch, Math.round(track.clientWidth * 0.7))
  track.scrollBy({ left: direction * step, behavior: scrollBehavior(true) })
}

onMounted(async () => {
  await refresh()
  centerCurrent(false)
  // Custom fonts change the label widths: measure again once they are loaded.
  document.fonts?.ready.then(() => refresh())
})

// The available width drives the arrows (and a media query could change the pitch).
useResizeObserver(trackRef, () => { void refresh() })

watch(stopsKey, async () => {
  await refresh()
  centerCurrent(true)
})
</script>

<template>
  <div v-if="stops.length"
    class="route-bar"
    role="navigation"
    aria-label="Arrêts desservis"
    :style="{
      '--accent': accent,
      '--rotation': `${ROTATION}deg`,
      '--label-space': `${labelSpace}px`,
      '--label-tail': `${labelTail}px`,
    }">
    <v-btn v-if="isScrollable"
      class="route-bar__arrow"
      icon="mdi-chevron-left"
      variant="tonal"
      density="compact"
      size="small"
      :disabled="!canScrollBack"
      aria-label="Arrêts précédents"
      @click="scrollStops(-1)" />

    <div ref="trackRef"
      class="route-bar__track"
      tabindex="0"
      aria-label="Liste des arrêts, défilement horizontal"
      @scroll.passive="updateArrows">
      <component :is="stop.slug && !stop.isCurrent ? NuxtLink : 'span'"
        v-for="(stop, index) in stops"
        :key="`${stop.slug ?? stop.name}-${index}`"
        :to="stop.slug && !stop.isCurrent ? `/station/${stop.slug}` : undefined"
        class="stop"
        :class="{
          'stop--current': stop.isCurrent,
          'stop--link': stop.slug && !stop.isCurrent,
        }"
        :title="stop.name"
        :aria-current="stop.isCurrent ? 'page' : undefined">
        <span class="stop__dot"
          aria-hidden="true" />
        <span class="stop__label">{{ stop.name }}</span>
      </component>
    </div>

    <v-btn v-if="isScrollable"
      class="route-bar__arrow"
      icon="mdi-chevron-right"
      variant="tonal"
      density="compact"
      size="small"
      :disabled="!canScrollForward"
      aria-label="Arrêts suivants"
      @click="scrollStops(1)" />
  </div>
</template>

<style scoped>
.route-bar {
  display: flex;
  align-items: flex-start;
  gap: 2px;
}

/* ── Arrows: parked on the same line as the dots ── */
.route-bar__arrow {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  margin-top: calc(var(--label-space) - 6px);
  opacity: .75;
}

.route-bar__arrow:hover {
  opacity: 1;
}

/* ── Scroller ── */
.route-bar__track {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  overflow-x: auto;
  /* A horizontal scroller cannot keep `overflow-y: visible`; the rotated labels
     stay fully visible because --label-space reserves their exact height. */
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
  padding-top: var(--label-space);
  padding-bottom: 8px;
  padding-inline: 8px var(--label-tail);
}

.route-bar__track::-webkit-scrollbar {
  display: none;
}

.route-bar__track:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
  border-radius: 8px;
}

/* ── One stop ── */
.stop {
  position: relative;
  flex: 0 0 auto;
  width: 42px;
  display: flex;
  justify-content: center;
  scroll-snap-align: center;
  text-decoration: none;
  color: inherit;
}

/* Connecting line: each stop draws its own segment, at the dot center. A single
   absolute line would only cover the visible width of the scroller. */
.stop::before {
  content: '';
  position: absolute;
  top: 7px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent);
  opacity: .3;
  pointer-events: none;
}

/* The two termini keep the line inside the network */
.stop:first-child::before {
  left: 50%;
}

.stop:last-child::before {
  right: 50%;
}

/* 16px box so the small and the large dot share the same center.
   `relative` keeps the dot painted above its line segment. */
.stop__dot {
  position: relative;
  width: 16px;
  height: 16px;
  display: grid;
  place-items: center;
}

.stop__dot::before {
  content: '';
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(var(--v-theme-on-surface), .38);
  box-shadow: 0 0 0 2px rgb(var(--v-theme-surface));
  transition: width .2s ease, height .2s ease, background .2s ease;
}

.stop--current .stop__dot::before {
  width: 14px;
  height: 14px;
  background: var(--accent);
  box-shadow: 0 0 0 3px rgb(var(--v-theme-surface));
}

.stop--link:hover .stop__dot::before {
  width: 12px;
  height: 12px;
  background: rgb(var(--v-theme-primary));
}

/* ── Label rotated at -35°, anchored on the dot ── */
.stop__label {
  position: absolute;
  bottom: calc(100% + 2px);
  left: 50%;
  max-width: 110px;
  transform-origin: bottom left;
  transform: rotate(var(--rotation));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  line-height: 1.25;
  color: rgba(var(--v-theme-on-surface), .68);
  pointer-events: none;
}

.stop--current .stop__label {
  color: rgb(var(--v-theme-on-surface));
  font-weight: 700;
}

.stop--link:hover .stop__label {
  color: rgb(var(--v-theme-primary));
}

/* ── Keyboard focus ── */
.stop:focus-visible {
  outline: none;
}

.stop:focus-visible .stop__dot::before {
  box-shadow: 0 0 0 3px rgb(var(--v-theme-primary));
}

.stop:focus-visible .stop__label {
  color: rgb(var(--v-theme-primary));
  text-decoration: underline;
}

@media (prefers-reduced-motion: reduce) {
  .stop__dot::before {
    transition: none;
  }
}
</style>
