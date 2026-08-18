<script setup lang="ts">
import StationDirectionToggle from '~/components/station/StationDirectionToggle.vue'
import StationLineToggles from '~/components/station/StationLineToggles.vue'
import StationRouteBar from '~/components/station/StationRouteBar.vue'
import type { ScheduleLine } from '~~/shared/types/schedule'

/**
 * Sticky card at the top of a station page: its name, whether the times are
 * real-time, the lines calling here, the direction picker and the stops of that
 * direction.
 *
 * Presentational only: the page owns the data, the favourite dialog and the
 * selected line and direction (through the two v-models below).
 */

/** One stop of the route bar. */
interface RouteBarStop {
  name: string
  slug: string
  isCurrent?: boolean
}

defineProps<{
  stopName: string
  lines: ScheduleLine[]
  /** Headsigns of the selected line, in the order of the toggle. */
  directionLabels: string[]
  stops: RouteBarStop[]
  /** Brand color of the selected line, hex WITHOUT the leading '#'. */
  lineColor?: string
  /** Short label of the selected line, e.g. "C3" or "A". */
  lineLabel?: string
  /** Headsign of the selected direction, e.g. "Lingolsheim Tiergaertel". */
  directionHeadsign?: string
  hasLiveData?: boolean
  isFavorite?: boolean
  /** The station has a platform we can add to a favourite list. */
  canFavorite?: boolean
  /** Another station is loading; this one stays readable meanwhile. */
  isLoading?: boolean
}>()

defineEmits<{ toggleFavorite: [] }>()

/** GTFS route_id of the selected line. */
const routeId = defineModel<string>('routeId', { required: true })
/** Index of the selected direction inside the line. */
const direction = defineModel<number>('direction', { required: true })
</script>

<template>
  <v-card rounded="lg"
    variant="flat"
    elevation="0"
    class="px-4 station-card">
    <!-- Switching station: the previous one stays readable, this only signals
         that the next one is on its way. -->
    <v-progress-linear v-if="isLoading"
      class="mb-2"
      color="primary"
      height="2"
      rounded
      indeterminate />

    <!-- Name, data source and favourite -->
    <div class="d-flex align-center justify-start gap-3">
      <v-card-title id="station-name"
        class="px-0 text-title-small text-sm-title-medium font-weight-medium font-italic">
        {{ stopName }}
      </v-card-title>

      <div class="mx-2 live-pill text-label-small text-uppercase font-weight-medium px-2 ma-0"
        :class="{ 'live-pill--on': hasLiveData }"
        role="status">
        <span class="live-pill__dot"
          aria-hidden="true" />
        {{ hasLiveData ? 'Temps réel' : 'Théorique' }}
      </div>

      <v-spacer />

      <v-btn icon
        variant="text"
        rounded="lg"
        density="compact"
        :color="isFavorite ? 'amber' : undefined"
        :aria-label="isFavorite ? 'Gérer les favoris' : 'Ajouter aux favoris'"
        :disabled="!canFavorite"
        @click="$emit('toggleFavorite')">
        <v-icon :icon="isFavorite ? 'mdi-star' : 'mdi-star-outline'"
          size="x-small" />
      </v-btn>
    </div>

    <!-- Lines calling here -->
    <div class="d-flex align-center gap-1 mb-1 opacity-75">
      <StationLineToggles v-model="routeId"
        :lines="lines" />
    </div>

    <!-- Direction -->
    <template v-if="directionLabels.length">
      <p class="text-label-small text-sm-label-medium text-uppercase font-weight-thin text-medium-emphasis ma-0 mt-2"
        aria-hidden="true">
        Direction
      </p>
      <StationDirectionToggle v-model="direction"
        :directions="directionLabels"
        aria-label="Choisir la direction" />
    </template>

    <!-- Stops of that direction -->
    <template v-if="stops.length">
      <StationRouteBar :stops="stops"
        :line-color="lineColor"
        :line-label="lineLabel"
        :direction-headsign="directionHeadsign"
        class="mt-1" />
    </template>
  </v-card>
</template>

<style scoped>
.station-card {
  border: 1px solid rgba(var(--v-theme-on-surface), .1);
  background: rgba(var(--v-theme-surface), .4);
  box-shadow: 0 8px 24px rgba(0, 0, 0, .08);
  backdrop-filter: blur(15px);
}

/* ── Live pill ── */
.live-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
  border-radius: 999px;
  color: rgba(var(--v-theme-on-surface), .62);
  background: rgba(var(--v-theme-on-surface), .07);
}

.live-pill__dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.live-pill--on {
  color: #4caf50;
  background: rgba(76, 175, 80, .14);
}

.live-pill--on .live-pill__dot {
  animation: live-pulse 1.8s ease-out infinite;
}

@keyframes live-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(76, 175, 80, .55);
  }

  70% {
    box-shadow: 0 0 0 6px rgba(76, 175, 80, 0);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .live-pill--on .live-pill__dot {
    animation: none;
  }
}
</style>
