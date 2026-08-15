<script setup lang="ts">
import { useRouteBarLayout } from '~/composables/useRouteBarLayout'

/**
 * Stops of the selected line and direction: dots on a horizontal line, with the
 * station names written at an angle above them. The current station is
 * highlighted and centered.
 *
 * Every pixel measurement and every scroll lives in useRouteBarLayout, so this
 * file only says WHAT to draw.
 */

/** One stop of the bar. Without a slug there is no page to link to. */
interface RouteBarStop {
  name: string
  slug?: string
  isCurrent?: boolean
}

const props = defineProps<{
  stops: RouteBarStop[]
  /** Brand color of the line, hex WITHOUT the leading '#'. */
  lineColor?: string
}>()

/** Angle of the labels. The room they need is derived from it. */
const LABEL_ANGLE = -35

const track = ref<HTMLElement | null>(null)

const {
  labelSpace,
  labelTail,
  isScrollable,
  canScrollBack,
  canScrollForward,
  measure,
  refreshArrows,
  centerCurrent,
  scrollStops,
} = useRouteBarLayout(track, LABEL_ANGLE)

const NuxtLink = resolveComponent('NuxtLink')

/** Line color, or the theme accent when GTFS gives us none. */
const accent = computed(() =>
  props.lineColor ? `#${props.lineColor.replace('#', '')}` : 'rgb(var(--v-theme-error))',
)

/** The current station is plain text: it is the page we are already on. */
function isLink(stop: RouteBarStop): boolean {
  return Boolean(stop.slug) && !stop.isCurrent
}

/** Identifies the list, so we re-measure only when its content changes. */
const stopsKey = computed(() =>
  props.stops.map(stop => `${stop.slug ?? stop.name}${stop.isCurrent ? '*' : ''}`).join('|'),
)

onMounted(async () => {
  await measure()
  centerCurrent(false)
})

watch(stopsKey, async () => {
  await measure()
  centerCurrent(true)
})
</script>

<template>
  <div
    v-if="stops.length"
    class="route-bar"
    role="navigation"
    aria-label="Arrêts desservis"
    :style="{
      '--accent': accent,
      '--label-angle': `${LABEL_ANGLE}deg`,
      '--label-space': `${labelSpace}px`,
      '--label-tail': `${labelTail}px`,
    }"
  >
    <v-btn
      v-if="isScrollable"
      class="route-bar__arrow"
      icon="mdi-chevron-left"
      variant="tonal"
      density="compact"
      size="small"
      :disabled="!canScrollBack"
      aria-label="Arrêts précédents"
      @click="scrollStops(-1)"
    />

    <div
      ref="track"
      class="route-bar__track"
      tabindex="0"
      aria-label="Liste des arrêts, défilement horizontal"
      @scroll.passive="refreshArrows"
    >
      <!-- NuxtLink prefetches on visibility by default, and Nuxt then downloads
           the timetable of that station too (plugins/prefetch-station.client.ts),
           so clicking a visible dot shows it right away. -->
      <component
        :is="isLink(stop) ? NuxtLink : 'span'"
        v-for="(stop, index) in stops"
        :key="`${stop.slug ?? stop.name}-${index}`"
        :to="isLink(stop) ? `/station/${stop.slug}` : undefined"
        class="stop"
        :class="{ 'stop--current': stop.isCurrent, 'stop--link': isLink(stop) }"
        :title="stop.name"
        :aria-current="stop.isCurrent ? 'page' : undefined"
      >
        <span class="stop__dot" aria-hidden="true" />
        <span class="stop__label">{{ stop.name }}</span>
      </component>
    </div>

    <v-btn
      v-if="isScrollable"
      class="route-bar__arrow"
      icon="mdi-chevron-right"
      variant="tonal"
      density="compact"
      size="small"
      :disabled="!canScrollForward"
      aria-label="Arrêts suivants"
      @click="scrollStops(1)"
    />
  </div>
</template>

<style scoped>
/*
  Three custom properties drive this stylesheet, all set by the template:
    --label-angle  tilt of the names
    --label-space  room reserved above the dots for the tilted names
    --label-tail   room reserved after the last stop, same reason
*/
.route-bar {
  display: flex;
  align-items: flex-start;
  gap: 2px;
}

/* ── Arrows, parked on the same line as the dots ── */
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
  display: flex;
  align-items: flex-start;
  flex: 1 1 auto;
  min-width: 0;
  overflow-x: auto;
  /* A horizontal scroller cannot keep `overflow-y: visible`; the tilted labels
     stay visible because --label-space reserves their exact height. */
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
  border-radius: 8px;
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

/* ── One stop ── */
.stop {
  position: relative;
  display: flex;
  justify-content: center;
  flex: 0 0 auto;
  width: 72px;
  scroll-snap-align: center;
  text-decoration: none;
  color: inherit;
}

/* Connecting line: every stop draws its own segment, at the dot center. One
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
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
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

/* ── Tilted label, anchored on its dot ── */
.stop__label {
  position: absolute;
  bottom: calc(100% + 2px);
  left: 50%;
  max-width: 110px;
  transform-origin: bottom left;
  transform: rotate(var(--label-angle));
  overflow: hidden;
  white-space: nowrap;
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
