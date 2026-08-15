<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import type { GeocodeResult } from '~~/shared/types/geocode'
import { useAddressSearch } from '~/composables/useAddressSearch'
import { useStopSearch } from '~/composables/useStopSearch'
import { useMapStore } from '~/stores/map'
import { useStopsStore } from '~/stores/stops'

const stopsStore = useStopsStore()
const mapStore = useMapStore()
const { query: stopQuery, results: stops } = useStopSearch()
const { query: placeQuery, results: places, loading: placesLoading } = useAddressSearch()

const rawQuery = ref('')
const stopsLoading = ref(false)
const stopsLoadFailed = ref(false)
const debouncedQuery = refDebounced(rawQuery, 120)
const focusedIndex = ref(-1)
const searchId = useId()
const resultsId = `${searchId}-results`

watch(debouncedQuery, (value) => {
  const normalizedValue = value.trim()
  stopQuery.value = normalizedValue.length >= 2 ? normalizedValue : ''
  // BAN requires at least three characters.
  placeQuery.value = normalizedValue.length >= 3 ? normalizedValue : ''
})

const stopResults = computed(() => stops.value.slice(0, 5))
const placeResults = computed(() => places.value.slice(0, 4))
const totalResults = computed(() => stopResults.value.length + placeResults.value.length)
const isOpen = computed(() => debouncedQuery.value.trim().length >= 2)
const isLoading = computed(() => rawQuery.value !== debouncedQuery.value || stopsLoading.value || (placesLoading.value && !stopResults.value.length))
const activeOptionId = computed(() => focusedIndex.value >= 0 ? `${searchId}-option-${focusedIndex.value}` : undefined)
const resultAnnouncement = computed(() => {
  if (!isOpen.value || isLoading.value) return ''
  if (!totalResults.value) return `Aucun résultat pour ${debouncedQuery.value}`
  return `${totalResults.value} résultat${totalResults.value > 1 ? 's' : ''} disponible${totalResults.value > 1 ? 's' : ''}`
})

onMounted(async () => {
  if (stopsStore.stops.length) return
  stopsLoading.value = true
  try {
    await stopsStore.fetchStops()
  }
  catch {
    stopsLoadFailed.value = true
  }
  finally {
    stopsLoading.value = false
  }
})

watch([stopResults, placeResults], () => { focusedIndex.value = -1 })

// Keep keyboard navigation visible while focus remains in the search field.
watch(focusedIndex, async (index) => {
  if (index < 0) return
  await nextTick()
  document.getElementById(`${searchId}-option-${index}`)?.scrollIntoView({
    block: 'nearest',
    inline: 'nearest',
    behavior: 'smooth',
  })
})

function moveFocus(delta: number) {
  if (!totalResults.value) return
  const next = focusedIndex.value + delta
  focusedIndex.value = next < 0 ? totalResults.value - 1 : next % totalResults.value
}

function selectStop(stopId: string) {
  const stop = stopsStore.stops.find(candidate => candidate.stopId === stopId)
  if (!stop) return

  stopsStore.selectStop(stopId)
  clearSearch()
  navigateTo({
    path: '/',
    query: {
      lat: String(stop.stopLat),
      lon: String(stop.stopLon),
      place: stop.stopName,
      results: 'nearby',
    },
  })
}

function selectPlace(place: GeocodeResult) {
  mapStore.focusPlace({ label: place.label, lat: place.lat, lon: place.lon })
  clearSearch()
  navigateTo({
    path: '/',
    query: {
      lat: String(place.lat),
      lon: String(place.lon),
      place: place.label,
      results: 'nearby',
    },
  })
}

function selectFocused() {
  if (focusedIndex.value < 0) return
  const stop = stopResults.value[focusedIndex.value]
  if (stop) return selectStop(stop.stopId)
  const place = placeResults.value[focusedIndex.value - stopResults.value.length]
  if (place) selectPlace(place)
}

function clearSearch() {
  rawQuery.value = ''
  focusedIndex.value = -1
}

function placeIcon(type: GeocodeResult['type']) {
  return type === 'municipality' ? 'mdi-city-variant-outline' : 'mdi-map-marker-outline'
}
</script>

<template>
  <div class="home-search" role="search" aria-label="Rechercher un arrêt, une adresse ou une ville">
    <v-text-field
      v-model="rawQuery"
      aria-label="Rechercher un arrêt, une adresse ou une ville"
      :aria-controls="isOpen ? resultsId : undefined"
      :aria-expanded="isOpen"
      :aria-activedescendant="activeOptionId"
      aria-autocomplete="list"
      aria-haspopup="listbox"
      autocomplete="off"
      class="search-field"
      color="primary"
      density="comfortable"
      hide-details
      placeholder="Insérer un arrêt, une adresse ou une ville…"
      prepend-inner-icon="mdi-magnify"
      rounded="lg"
      variant="solo-filled"
      :loading="isLoading"
      @keydown.down.prevent="moveFocus(1)"
      @keydown.up.prevent="moveFocus(-1)"
      @keydown.enter.prevent="selectFocused"
      @keydown.esc="clearSearch"
    >
      <template v-if="rawQuery && !isLoading" #append-inner>
        <v-btn
          aria-label="Effacer la recherche"
          density="comfortable"
          icon="mdi-close"
          size="small"
          variant="text"
          @click="clearSearch"
        />
      </template>
    </v-text-field>

    <span class="sr-only " role="status" aria-live="polite" aria-atomic="true">
      {{ resultAnnouncement }}
    </span>

    <v-card
      v-if="isOpen"
      :id="resultsId"
      class="results-card border-thin border-opacity mt-2 overflow-y-auto pa-2"
      elevation="12"
      role="listbox"
      :aria-labelledby="`${searchId}-results-title`"
      :aria-busy="isLoading"
      rounded="lg"
    >
      <div class="d-flex align-center justify-space-between py-1">
        <div class="pa-0 ma-0">
          <!-- SEARCH query binding -->
          <p :id="`${searchId}-title`" class="pa-0 ma-0 text-label-small  text-disabled">
            votre recherche: "{{rawQuery}}"
          </p>
          
          <!-- Search Result -->
          <h3 :id="`${searchId}-results-title`" class="mt-3 mb-1 text-label-large text-sm-body-large font-weight-bold text-disabled">
            Résultats
          </h3>
          <p class="ma-0 mb-1 text-label-small text-sm-body-medium text-medium-emphasis">
            Arrêts, adresses et villes
          </p>
        </div>

        <v-chip v-if="!isLoading" class="align-self-end mb-1" color="primary" size="small" variant="tonal" aria-hidden="true">
          {{ totalResults }}
        </v-chip>
      </div>

      <v-divider />

      <div v-if="isLoading && !totalResults" class="d-flex flex-column align-center justify-center ga-3 pa-8 text-medium-emphasis">
        <v-progress-circular color="primary" indeterminate size="26" width="2" aria-hidden="true" />
        <span class="text-body-2">
          Recherche en cours…
        </span>
      </div>

      <!-- Search  Resultats -->
      <v-list v-else class="py-2 bg-transparent" density="comfortable">
        <!-- Search  Resultats ARRETS -->
        <template v-if="stopResults.length">
          <v-list-subheader class="text-label-large text-sm-title-medium font-weight-thin font-italic text-disabled pa-0">
            Arrêts
          </v-list-subheader>

          <v-list-item
            v-for="(stop, index) in stopResults"
            :id="`${searchId}-option-${index}`"
            :key="stop.stopId"
            :active="focusedIndex === index"
            class="result-item text-medium-emphasis ma-0 pa-1 mb-2 "
            role="option"
            :aria-selected="focusedIndex === index"
            :aria-label="`${stop.stopName}${stop.routes.length ? `, lignes ${stop.routes.slice(0, 6).join(', ')}` : ''}`"
            rounded="lg"
            tabindex="-1"
            @click="selectStop(stop.stopId)"
          >
            <template #prepend>
              <v-avatar size="24" variant="tonal">
                <v-icon icon="mdi-bus-stop" size="20" aria-hidden="true" />
              </v-avatar>
            </template>
            <v-list-item-title class="pa-0 ma-0 font-weight-semibold text-label-large text-sm-title-medium font-weight-thin">
              {{ stop.stopName }}
            </v-list-item-title>
            <v-list-item-subtitle class="disabled text-label-large">
              {{ stop.routes.length ? `Lignes ${stop.routes.slice(0, 6).join(' · ')}` : 'Arrêt de transport' }}
            </v-list-item-subtitle>
            <template #append>
              <v-icon icon="mdi-arrow-top-right" size="18" aria-hidden="true" />
            </template>
          </v-list-item>
        </template>

        <!-- Search  Resultats Adresses & Villes -->
        <template v-if="placeResults.length">
          <v-list-subheader  class="text-label-large text-sm-title-medium font-weight-thin font-italic  text-disabled pa-0">
            Adresses &amp; villes
          </v-list-subheader>
          <v-list-item
            v-for="(place, index) in placeResults"
            :id="`${searchId}-option-${stopResults.length + index}`"
            :key="place.id"
            :active="focusedIndex === stopResults.length + index"
            class="result-item ma-0 pa-1 mb-2 text-medium-emphasis"
            role="option"
            :aria-selected="focusedIndex === stopResults.length + index"
            :aria-label="`${place.label}${place.context ? `, ${place.context}` : ''}`"
            rounded="lg"
            tabindex="-1"
            @click="selectPlace(place)"
          >
            <template #prepend>
              <v-avatar size="24" variant="tonal" >
                <v-icon :icon="placeIcon(place.type)" size="20" aria-hidden="true" />
              </v-avatar>
            </template>
            <v-list-item-title class="pa-0 ma-0 font-weight-semibold text-label-large text-sm-title-medium font-weight-thin">
              {{ place.label }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{ place.context || (place.type === 'municipality' ? 'Ville' : 'Adresse') }}
            </v-list-item-subtitle>
            <template #append>
              <v-icon icon="mdi-arrow-top-right" size="18" aria-hidden="true" />
            </template>
          </v-list-item>
        </template>
        
        <!-- Search Failed -->
        <v-empty-state
          v-if="stopsLoadFailed && !totalResults"
          class="pa-0"
          headline="Arrêts indisponibles"
          icon="mdi-cloud-alert-outline"
          text="La recherche d’adresses et de villes reste active."
        />
        
        <!-- search Empty 0 -->
        <v-empty-state
          v-else-if="!isLoading && !totalResults"
          class="pa-0"
          headline="Aucun résultat"
          icon="mdi-map-search-outline"
          :text="`Aucun résultat précis pour « ${debouncedQuery} ».`"
        />
      </v-list>

      <div v-if="totalResults" class="d-flex align-center ga-2 px-0 py-2 text-caption text-medium-emphasis border-t-sm">
        <v-icon icon="mdi-keyboard" size="15" aria-hidden="true" />
        <span><kbd>↑</kbd><kbd>↓</kbd> naviguer · <kbd>Entrée</kbd> sélectionner</span>
      </div>
    </v-card>
  </div>
</template>

<style scoped>
.home-search {
  position: relative;
  z-index: 5;
}

.search-field :deep(.v-field) { 
  min-height: 44px;
  border: 1px solid rgba(var(--v-theme-on-surface), .1); 
  box-shadow: none;
}
.search-field :deep(.v-field--focused) { border-color: rgb(var(--v-theme-primary)); box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), .16); }
.search-field :deep(.v-field__input) { min-height: 42px; padding-block: 0;}
.results-card { 
  inset-inline: 0; 
  position: absolute; 
  scrollbar-width: thin;
  backdrop-filter: blur(24px);
  border-color: #3635358f; 
  max-height: min(460px, 62dvh); 
  -webkit-backdrop-filter: blur(24px); 
  background: rgba(var(--v-theme-surface), .98); 
}
.result-item { 
  min-height: 32px; 
  border: 1px solid transparent;
}
.result-item:hover, .result-item.v-list-item--active { border-color: rgba(var(--v-theme-primary), .18); }
.result-item:focus-visible { outline: 3px solid rgb(var(--v-theme-primary)); outline-offset: 4px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;}
kbd { display: inline-grid; min-width: 18px; min-height: 18px; margin-inline: 1px; place-items: center; border: 1px solid rgba(var(--v-theme-on-surface), .2); border-radius: 4px; font: inherit; }
@media (max-width: 480px) { 
  .results-card { 
    position: fixed; 
    top: 45px; 
    right: 12px; 
    left: 12px; 
    max-height: min(520px, calc(100dvh - 150px)); 
  } 
  .search-field:deep(.v-field){
    font-size: .6rem;
    padding: 0 2px;
  }
  .search-field:deep(.v-field__input)  {
    padding-right: 4px;
    padding-left: 4px;
  }

}
@media (prefers-reduced-motion: reduce) { 
  .result-item { transition: none !important; } 
  .results-card { scroll-behavior: auto; } 
}
@media (forced-colors: active) { 
  .results-card, .result-item { 
    border: 1px solid CanvasText;
  }
}
</style>