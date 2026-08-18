<script setup lang="ts">
import { useRouteBarScroll } from '~/composables/useRouteBarScroll'
import { lineQuery } from '~/composables/useStationLines'

/**
 * Stops of the selected line and direction: dots on a horizontal line, with the
 * station names written at an angle above them. The current station is
 * highlighted and centered; every other dot links to its own page.
 */
interface RouteBarStop {
  name: string
  slug: string
  isCurrent?: boolean
}

const props = defineProps<{
  stops: RouteBarStop[]
  /** Brand color of the line, hex WITHOUT the leading '#'. */
  lineColor?: string
  /** Label of the active line, e.g. 'C3' — carried to the next station as `?line=c3`. */
  lineLabel?: string
}>()

const track = ref<HTMLElement | null>(null)
const { canScrollBack, canScrollForward, isScrollable, updateArrows, centerCurrent, scrollStops } = useRouteBarScroll(track)

/** Line color, or the theme accent when GTFS gives us none. */
const accent = computed(() =>
  props.lineColor ? `#${props.lineColor.replace('#', '')}` : 'rgb(var(--v-theme-error))',
)

/** Changes with the list or the current stop, not on every parent render. */
const stopsKey = computed(() =>
  props.stops.map(stop => `${stop.slug}${stop.isCurrent ? '*' : ''}`).join(),
)

/** `?line=c3`, so the next station opens on the line we are reading. */
const stopQuery = computed(() => lineQuery(props.lineLabel))

onMounted(() => {
  centerCurrent(false)
})

// `flush: 'post'` waits for the new dots to be in the DOM before scrolling.
watch(stopsKey, () => centerCurrent(true), { flush: 'post' })
</script>

<template>
  <div v-if="stops.length"
    class="route-bar"
    role="navigation"
    aria-label="Arrêts desservis"
    :style="{ '--accent': accent }">
    <v-btn v-if="isScrollable"
      class="route-bar__arrow"
      icon="mdi-chevron-left"
      variant="tonal"
      density="compact"
      size="x-small"
      :disabled="!canScrollBack"
      aria-label="Arrêts précédents"
      @click="scrollStops(-1)" />

    <div ref="track"
      class="route-bar__track"
      tabindex="0"
      aria-label="Liste des arrêts, défilement horizontal"
      @scroll.passive="updateArrows">
      <!-- NuxtLink prefetches the dots entering the viewport, and Nuxt then
           caches their timetable too (plugins/prefetch-station.client.ts). -->
      <NuxtLink v-for="(stop, index) in stops"
        :key="`${stop.slug}-${index}`"
        :to="{ path: `/station/${stop.slug}`, query: stopQuery }"
        class="stop"
        :class="{ 'stop--current': stop.isCurrent }"
        :title="stop.name"
        :aria-current="stop.isCurrent ? 'page' : undefined">
        <span class="stop__dot"
          aria-hidden="true" />
        <span class="stop__label text-label-x-small font-weight-thin font-italic">
          {{ stop.name }}
        </span>
      </NuxtLink>
    </div>

    <v-btn v-if="isScrollable"
      class="route-bar__arrow"
      icon="mdi-chevron-right"
      variant="tonal"
      density="compact"
      size="x-small"
      :disabled="!canScrollForward"
      aria-label="Arrêts suivants"
      @click="scrollStops(1)" />
  </div>
</template>

<style scoped>
.route-bar {
  /*
    A name written at an angle overflows its box up and to the right, and a
    horizontal scroller always clips vertically. So we reserve the room the
    WIDEST allowed name needs. Change these five together:
      space = max * sin(angle) + line-height + 4px  ->  96 * 0.57 + 14 + 4
      tail  = max * cos(angle) - width / 2          ->  96 * 0.82 - 36
  */
  --label-angle: -45deg;
  --label-max: 96px;
  --label-space: 72px;
  --label-tail: 44px;
  --stop-width: 38px;

  display: flex;
  align-items: flex-start;
  gap: 2px;
  background: #0000003d;
  padding: 1px 2px;
  border-radius: 12px;
  border: 1px solid black;
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
  display: flex;
  align-items: flex-start;
  flex: 1 1 auto;
  min-width: 0;
  overflow-x: auto;
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
  width: var(--stop-width);
  scroll-snap-align: center;
  text-decoration: none;
  color: inherit;
}

/* Every stop draws its own piece of the line, at the height of the dots. One
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
}

.stop:first-child::before {
  left: 50%;
}

.stop:last-child::before {
  right: 50%;
}

/* 16px box, so the small and the large dot share the same center */
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

.stop:hover .stop__dot::before {
  width: 12px;
  height: 12px;
  background: rgb(var(--v-theme-primary));
}

.stop--current .stop__dot::before {
  width: 14px;
  height: 14px;
  background: var(--accent);
  box-shadow: 0 0 0 3px rgb(var(--v-theme-surface));
}

/* ── Name, tilted above its dot ── */
.stop__label {
  position: absolute;
  bottom: calc(100% + 2px);
  left: 50%;
  max-width: var(--label-max);
  transform-origin: bottom left;
  transform: rotate(var(--label-angle));
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: rgba(var(--v-theme-on-surface), .68);
  pointer-events: none;
}

.stop:hover .stop__label {
  color: rgb(var(--v-theme-primary));
}

.stop--current .stop__label {
  color: rgb(var(--v-theme-on-surface));
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

.text-label-x-small {
  font-size: .5em;
}
</style>
