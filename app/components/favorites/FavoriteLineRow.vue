<script setup lang="ts">
/**
 * One line block inside a FavoriteStopCard, aligned on a fixed grid:
 *
 *   [A]  → Illkirch Graffenstaden   dans 2 min · puis 9 min
 *        ← Parc des Sports          dans 4 min · puis 9 min
 */

/** One direction of a line: terminus + the next two departures. */
export interface LineDirection {
  /** Terminus displayed to the rider, e.g. "Pont Phario". */
  destination: string
  /** Minutes until the next departure. 0 means imminent. */
  nextMin: number
  /** Minutes until the departure after that, when known. */
  thenMin?: number
}

/** All upcoming departures of one line at the stop, grouped by direction. */
interface LineDepartures {
  /** Line label shown in the badge, e.g. "C6" or "70". */
  label: string
  /** Badge background colour (hex from GTFS routes.txt, with '#'). */
  color: string
  mode: 'tram' | 'bus'
  /** True when at least one time comes from the real-time feed. */
  realtime: boolean
  /** 1 or 2 entries: outbound first, opposite direction second. */
  directions: LineDirection[]
}

export type { LineDepartures }

const props = defineProps<{ line: LineDepartures }>()

/** Black or white badge text, computed from the background luminance. */
const badgeTextColor = computed(() => contrastTextColor(props.line.color))

function countdown(minutes: number) {
  return minutes > 0 ? `dans ${minutes} min` : 'Imminent'
}
</script>

<template>
  <li class="line-row py-2">
    <!-- Line badge. "Ligne" prefix is for screen readers only. -->
    <span
      class="line-badge"
      :style="{ background: line.color, color: badgeTextColor }"
    >
      <span class="sr-only">Ligne </span>{{ line.label }}
    </span>

    <!-- Directions: outbound (→) then opposite (←). -->
    <ul class="line-row__directions pa-0 ma-0">
      <li
        v-for="(direction, index) in line.directions"
        :key="direction.destination"
        class="line-row__direction"
      >
        <v-icon
          :icon="index === 0 ? 'mdi-arrow-right' : 'mdi-arrow-left'"
          size="14"
          class="line-row__direction-icon"
          aria-hidden="true"
        />
        <span class="sr-only">{{ index === 0 ? 'Direction' : 'Direction opposée' }}</span>

        <span
          class="line-row__destination text-body-2"
          :title="direction.destination"
        >
          {{ direction.destination }}
        </span>

        <span class="line-row__times text-body-2">
          <strong>{{ countdown(direction.nextMin) }}</strong>
          <span
            v-if="direction.thenMin !== undefined"
            class="text-caption text-medium-emphasis"
          >
            · puis {{ direction.thenMin > 0 ? `${direction.thenMin} min` : 'imminent' }}
          </span>
        </span>
      </li>
    </ul>
  </li>
</template>

<style scoped>
/* Fixed two-column grid keeps every row aligned across the card. */
.line-row {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  column-gap: 12px;
  align-items: start;
}

/* Thin translucent divider between two line blocks (theme-aware). */
.line-row + .line-row { border-top: 1px solid rgba(var(--v-theme-on-surface), .1); }

/* Same badge look as the served-lines row in FavoriteStopCard. */
.line-badge {
  display: grid;
  place-items: center;
  min-width: 32px;
  height: 26px;
  margin-top: 3px;
  padding-inline: 7px;
  border-radius: 8px;
  font-size: .75rem; /* ≥ 12px so line labels stay readable */
  font-weight: 850;
  letter-spacing: .02em;
}

.line-row__directions { list-style: none; min-width: 0; }

/* One direction = one aligned line: arrow / destination / times. */
.line-row__direction {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto;
  column-gap: 8px;
  align-items: center;
  /* A touch taller for a calm, uncramped reading rhythm. */
  min-height: 32px;
}

.line-row__direction-icon { opacity: .55; }

.line-row__destination {
  overflow: hidden;
  color: rgba(var(--v-theme-on-surface), .82);
  /* Fluid 14→15px, relaxed line-height for readability. */
  font-size: clamp(.875rem, .84rem + .2vw, .9375rem);
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.line-row__times {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  white-space: nowrap;
}
.line-row__times strong { font-size: clamp(.875rem, .84rem + .2vw, .9375rem); }

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

@media (forced-colors: active) {
  .line-badge { forced-color-adjust: none; }
}
</style>
