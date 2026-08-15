<!--
  ArrivalRow (Step 3.2)

  One departure row: line badge, destination, mode, countdown, clock time
  and the data-source chip (Temps réel / Estimé / Théorique).

  Dumb component contract:
    props: arrival — the departure to render
           is-next — highlights the very next departure
-->
<script setup lang="ts">
import type { StopArrival } from '~~/shared/types/stop'
import { formatTime, relativeArrival, statusChipColor, statusChipLabel } from '~/utils/format'
import { useNow } from '~/composables/useNow'

defineProps<{
  arrival: StopArrival
  isNext?: boolean
}>()

const { now } = useNow()
</script>

<template>
  <v-list-item
    class="arrival-item rounded-lg my-1 px-2"
    :class="{ 'arrival-item--next': isNext }"
  >
    <template #prepend>
      <v-avatar
        :color="`#${arrival.routeColor}`"
        size="36"
        rounded="lg"
        class="mr-3 font-weight-bold text-caption"
        :style="{ color: `#${arrival.routeTextColor}` }"
      >
        {{ arrival.lineLabel }}
      </v-avatar>
    </template>

    <v-list-item-title class="text-body-2 font-weight-medium">
      {{ arrival.destination }}
    </v-list-item-title>
    <v-list-item-subtitle class="text-caption">
      {{ arrival.mode === 'tram' ? 'Tram' : 'Bus' }}
    </v-list-item-subtitle>

    <template #append>
      <div class="arrival-time d-flex flex-column align-end ml-3">
        <span class="text-subtitle-1 font-weight-bold text-primary">
          {{ relativeArrival(arrival.scheduledArrival, now) }}
        </span>
        <span class="text-caption text-medium-emphasis">
          {{ formatTime(arrival.scheduledArrival) }}
        </span>
        <v-chip
          size="x-small"
          variant="tonal"
          :color="statusChipColor(arrival.status)"
          class="mt-1"
        >
          {{ statusChipLabel(arrival.status) }}
        </v-chip>
      </div>
    </template>
  </v-list-item>
</template>

<style scoped>
.arrival-item {
  min-height: 72px;
  border: 1px solid transparent;
  transition: background-color 150ms ease, border-color 150ms ease;
}
.arrival-item:hover { background: rgba(var(--v-theme-on-surface), .035); }
.arrival-item--next {
  background: rgba(var(--v-theme-primary), .06);
  border-color: rgba(var(--v-theme-primary), .16);
}
.arrival-time { min-width: 72px; }
</style>
