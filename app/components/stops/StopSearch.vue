<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import { useAddressSearch } from '~/composables/useAddressSearch'
import { useNearestStops } from '~/composables/useNearestStops'
import { useStopSearch } from '~/composables/useStopSearch'
import { useMapStore } from '~/stores/map'
import { useStopsStore } from '~/stores/stops'
import type { GeocodeResult } from '~~/shared/types/geocode'

const stopsStore = useStopsStore()
const mapStore = useMapStore()
const { query, results } = useStopSearch()
const { query: placeQuery, results: places, loading: placesLoading } = useAddressSearch()
const { nearest, loading, error: geoError, requestLocation, findNearest } = useNearestStops()

// ── Debounced input ───────────────────────────────────────────────────────
const rawQuery = ref('')
const debouncedQuery = refDebounced(rawQuery, 250)
const isSearching = ref(false)

watch(debouncedQuery, async (val) => {
  isSearching.value = true
  query.value = val // stop search (local, instant)
  placeQuery.value = val // address / city search (BAN geocoding API)
  await nextTick()
  isSearching.value = false
})

// ── Combined results (stops first, then addresses & cities) ──────────────
const MAX_STOP_RESULTS = 5
const MAX_PLACE_RESULTS = 4

const stopResults = computed(() => results.value.slice(0, MAX_STOP_RESULTS))
const placeResults = computed(() => places.value.slice(0, MAX_PLACE_RESULTS))
const totalResults = computed(() => stopResults.value.length + placeResults.value.length)

// ── Keyboard navigation (over the combined stop + place list) ─────────────
const focusedIndex = ref(-1)

watch([stopResults, placeResults], () => { focusedIndex.value = -1 })

function moveFocus(delta: number) {
  const max = totalResults.value - 1
  focusedIndex.value = Math.max(0, Math.min(focusedIndex.value + delta, max))
}

/**
 * Enter key: indexes 0..stopResults.length-1 map to stops,
 * the remainder maps into the places list.
 */
function selectFocused() {
  const idx = focusedIndex.value
  if (idx < 0) return
  const stop = stopResults.value[idx]
  if (stop) return select(stop.stopId)
  const place = placeResults.value[idx - stopResults.value.length]
  if (place) selectPlace(place)
}

// ── Hydrate favourites on mount (needed for the map gold-ring layer) ────
// Even though the favourites list is no longer shown in this panel,
// we still hydrate so the gold ring on the map stays accurate.
onMounted(stopsStore.hydrateFavorites)

// ── Actions ───────────────────────────────────────────────────────────────
function select(stopId: string) {
  stopsStore.selectStop(stopId)
  rawQuery.value = ''
  focusedIndex.value = -1
}

/**
 * selectPlace — the user picked an address or a city:
 *   1. Fly the map there and drop a pin (via the map store).
 *   2. Fetch the closest stops so the "Arrêts à proximité" card fills in.
 */
function selectPlace(place: GeocodeResult) {
  mapStore.focusPlace({ label: place.label, lat: place.lat, lon: place.lon })
  findNearest(place.lat, place.lon)
  rawQuery.value = ''
  focusedIndex.value = -1
}

/** Icon per geocoding result type: whole city vs precise address / street. */
function placeIcon(type: GeocodeResult['type']): string {
  return type === 'municipality' ? 'mdi-city' : 'mdi-map-marker'
}

function formatDistance(distanceM: number): string {
  return distanceM < 1_000
    ? `${Math.round(distanceM)} m`
    : `${(distanceM / 1_000).toFixed(1)} km`
}
</script>

<template>
  <!--
    Search panel fixed at the top-left of the map.

    Features:
    - 250 ms debounce so the search APIs are not hammered on every keystroke.
    - Searches stops (local) AND addresses / cities (BAN geocoding) at once.
    - Full keyboard navigation (↑↓ to move focus, Enter to select, Esc to clear).
    - Nearby stops section with a "Près de moi" button.
  -->
  <div class="stop-search" role="search" aria-label="Rechercher un arrêt, une adresse ou une ville">

    <!-- ── Search input ──────────────────────────────────────────────────── -->
    <v-card class="glass-surface" elevation="6" rounded="lg">
      <v-text-field
        v-model="rawQuery"
        aria-label="Arrêt, adresse ou ville"
        clearable
        density="compact"
        hide-details
        placeholder="Arrêt, adresse ou ville…"
        prepend-inner-icon="mdi-magnify"
        variant="solo"
        :loading="isSearching || placesLoading"
        @keydown.down.prevent="moveFocus(1)"
        @keydown.up.prevent="moveFocus(-1)"
        @keydown.enter.prevent="selectFocused"
        @keydown.esc="rawQuery = ''"
      />

      <!-- Search results: stops first, then geocoded addresses & cities -->
      <v-list
        v-if="debouncedQuery && totalResults"
        class="results"
        density="compact"
      >
        <template v-if="stopResults.length">
          <v-list-subheader>Arrêts</v-list-subheader>
          <v-list-item
            v-for="(stop, idx) in stopResults"
            :key="stop.stopId"
            :active="focusedIndex === idx"
            prepend-icon="mdi-bus-stop"
            @click="select(stop.stopId)"
          >
            <v-list-item-title>{{ stop.stopName }}</v-list-item-title>
          </v-list-item>
        </template>

        <template v-if="placeResults.length">
          <v-list-subheader>Adresses &amp; villes</v-list-subheader>
          <v-list-item
            v-for="(place, idx) in placeResults"
            :key="place.id"
            :active="focusedIndex === stopResults.length + idx"
            :prepend-icon="placeIcon(place.type)"
            @click="selectPlace(place)"
          >
            <v-list-item-title>{{ place.label }}</v-list-item-title>
            <v-list-item-subtitle v-if="place.context">{{ place.context }}</v-list-item-subtitle>
          </v-list-item>
        </template>
      </v-list>

      <!-- No results message -->
      <p
        v-else-if="debouncedQuery && !isSearching && !placesLoading && !totalResults"
        class="text-body-2 text-medium-emphasis pa-3 mb-0"
      >
        Aucun résultat pour « {{ debouncedQuery }} ».
      </p>
    </v-card>

    <!-- ── Nearby stops ──────────────────────────────────────────────────── -->
    <v-card
      v-if="nearest.length || geoError"
      class="mt-2 glass-surface"
      elevation="6"
      rounded="lg"
    >
      <v-list density="compact">
        <v-list-subheader>Arrêts à proximité</v-list-subheader>

        <v-list-item
          v-for="stop in nearest"
          :key="stop.stopId"
          prepend-icon="mdi-map-marker-radius"
          @click="select(stop.stopId)"
        >
          <v-list-item-title>{{ stop.stopName }}</v-list-item-title>
          <template #append>
            <span class="text-caption text-medium-emphasis">
              {{ formatDistance(stop.distanceM) }}
            </span>
          </template>
        </v-list-item>

        <v-list-item v-if="geoError">
          <v-list-item-title class="text-body-2 text-medium-emphasis">
            {{ geoError }}
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-card>

    <!-- ── Geolocation button ────────────────────────────────────────────── -->
    <v-btn
      class="mt-2 glass-surface"
      :loading="loading"
      prepend-icon="mdi-crosshairs-gps"
      variant="elevated"
      size="small"
      @click="requestLocation"
    >
      Près de moi
    </v-btn>
  </div>
</template>



<style scoped>
.stop-search {
  position: fixed;
  top: 56px;
  left: 12px;
  z-index: 10;
  width: min(360px, calc(100vw - 24px));
}

.results { max-height: min(280px, 40dvh); overflow-y: auto; }

/* Let the glass card show through Vuetify's opaque field & list defaults */
.stop-search :deep(.v-field--variant-solo) {
  background: transparent;
  box-shadow: none;
}
.stop-search :deep(.v-list) {
  background: transparent;
}

@media (max-width: 600px) {
  .stop-search { top: 52px; }
}
</style>
