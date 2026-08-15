<!--
  ArrivalsList (Step 3.2)

  The « Prochains passages » section: header with refresh action, loading
  skeletons, empty state and the departure rows.

  Dumb component contract:
    props:  arrivals — departures to render (already sorted by time)
            pending  — true while (re)fetching; shows skeletons
    emits:  refresh  — the user clicked the refresh button
-->
<script setup lang="ts">
import type { StopArrival } from '~~/shared/types/stop'
import ArrivalRow from '~/components/stops/ArrivalRow.vue'

defineProps<{
  arrivals: StopArrival[]
  pending: boolean
}>()

const emit = defineEmits<{
  refresh: []
}>()
</script>

<template>
  <div class="d-flex align-center px-4 pt-3 pb-1">
    <div>
      <div class="text-subtitle-2 font-weight-bold">Prochains passages</div>
      <div class="text-caption text-medium-emphasis">Départs dans les 90 prochaines minutes</div>
    </div>
    <v-spacer />
    <v-btn
      icon="mdi-refresh"
      size="small"
      variant="tonal"
      color="primary"
      :loading="pending"
      aria-label="Actualiser les passages"
      @click="emit('refresh')"
    />
  </div>

  <v-card-text class="pa-0 px-2 pb-2">

    <!-- Loading skeletons -->
    <template v-if="pending">
      <v-list density="compact">
        <v-list-item v-for="i in 4" :key="i">
          <template #prepend>
            <v-skeleton-loader type="avatar" width="36" height="36" class="mr-3" />
          </template>
          <v-skeleton-loader type="text" width="160" />
          <v-skeleton-loader type="text" width="80" class="mt-1" />
        </v-list-item>
      </v-list>
    </template>

    <!-- Empty state -->
    <div
      v-else-if="!arrivals.length"
      class="d-flex flex-column align-center justify-center py-8 text-medium-emphasis"
    >
      <v-icon icon="mdi-timetable" size="40" class="mb-3 text-disabled" />
      <span class="text-body-2">
        Aucun passage prévu dans les 90 prochaines minutes.
      </span>
    </div>

    <!-- Departure rows -->
    <v-list v-else density="compact" class="arrivals-list">
      <ArrivalRow
        v-for="(arrival, index) in arrivals"
        :key="arrival.tripId"
        :arrival="arrival"
        :is-next="index === 0"
      />
    </v-list>
  </v-card-text>
</template>

<style scoped>
.arrivals-list {
  max-height: min(410px, 52dvh);
  overflow-y: auto;
  scrollbar-width: thin;
}

@media (max-width: 600px) {
  .arrivals-list { max-height: 48dvh; }
}
</style>
