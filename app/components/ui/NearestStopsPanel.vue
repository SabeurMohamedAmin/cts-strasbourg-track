<!--
  NearestStopsPanel (Step 3.3)

  The « Arrêts près de moi » section: geolocation button, error message
  and the nearest-stops list. Geolocation itself lives in the parent
  (useNearestStops) — this component only renders its state.

  Dumb component contract:
    props:  nearest — nearby stops with their distance in metres
            loading — true while the position is being resolved
            error   — geolocation error text, null when fine
    emits:  locate         — the user clicked the geolocation button
            select(stopId) — the user clicked a stop
-->
<script setup lang="ts">
/** Minimal stop shape needed to render a nearby row. */
interface NearbyStop {
  stopId: string
  stopName: string
  distanceM: number
}

defineProps<{
  nearest: NearbyStop[]
  loading: boolean
  error: string | null
}>()

const emit = defineEmits<{
  locate: []
  select: [stopId: string]
}>()

function formatDistance(d: number) {
  return d < 1_000 ? `${d} m` : `${(d / 1_000).toFixed(1)} km`
}
</script>

<template>
  <div class="pa-3">
    <v-btn
      block
      :loading="loading"
      prepend-icon="mdi-crosshairs-gps"
      variant="tonal"
      color="primary"
      @click="emit('locate')"
    >
      Arrêts près de moi
    </v-btn>

    <p v-if="error" class="text-caption text-error mt-2 mb-0">{{ error }}</p>

    <v-list
      v-if="nearest.length"
      class="mt-2 rounded-lg elevation-1"
      density="compact"
      max-height="180"
      style="overflow-y:auto"
    >
      <v-list-item
        v-for="stop in nearest"
        :key="stop.stopId"
        prepend-icon="mdi-map-marker-radius"
        :title="stop.stopName"
        rounded
        @click="emit('select', stop.stopId)"
      >
        <template #append>
          <span class="text-caption text-medium-emphasis">
            {{ formatDistance(stop.distanceM) }}
          </span>
        </template>
      </v-list-item>
    </v-list>
  </div>
</template>

<style scoped>
/* Semi-translucent so the glass drawer shows through */
.v-list {
  background: rgba(var(--v-theme-surface), 0.5);
}
</style>
