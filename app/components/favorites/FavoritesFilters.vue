<script setup lang="ts">
type TransportMode = 'all' | 'tram' | 'bus'
type SortKey = 'custom' | 'departures' | 'name'

const props = defineProps<{
  search: string
  selectedGroup: string
  selectedMode: TransportMode
  nearOnly: boolean
  sortBy: SortKey
  groupOptions: { value: string, title: string }[]
}>()

const emit = defineEmits<{
  'update:search': [value: string]
  'update:selectedGroup': [value: string]
  'update:selectedMode': [value: TransportMode]
  'update:nearOnly': [value: boolean]
  'update:sortBy': [value: SortKey]
}>()

const isOpen = ref(false)
const searchInput = ref(props.search)
let searchTimer: ReturnType<typeof setTimeout> | undefined

watch(() => props.search, (value) => {
  if (value !== searchInput.value) searchInput.value = value
})

function updateSearch(value: string) {
  searchInput.value = value
  clearTimeout(searchTimer)

  const query = value.trim()
  if (query.length > 0 && query.length < 3) return

  searchTimer = setTimeout(() => emit('update:search', value), 250)
}

onBeforeUnmount(() => clearTimeout(searchTimer))

const modes: { id: TransportMode, label: string, icon: string }[] = [
  { id: 'all', label: 'Tous', icon: 'mdi-transit-connection-variant' },
  { id: 'tram', label: 'Tram', icon: 'mdi-tram' },
  { id: 'bus', label: 'Bus', icon: 'mdi-bus' },
]
const sortOptions: { value: SortKey, title: string }[] = [
  { value: 'custom', title: 'Ordre personnalisé' },
  { value: 'departures', title: 'Prochains départs' },
  { value: 'name', title: "Nom de l'arrêt" },
]
const activeFilterCount = computed(() => [
  props.search.trim().length > 0,
  props.selectedGroup !== 'all',
  props.selectedMode !== 'all',
  props.nearOnly,
  props.sortBy !== 'custom',
].filter(Boolean).length)

function clearFilters() {
  emit('update:search', '')
  emit('update:selectedGroup', 'all')
  emit('update:selectedMode', 'all')
  emit('update:nearOnly', false)
  emit('update:sortBy', 'custom')
}
</script>

<template>
  <section class="mb-6" aria-label="Filtrer les favoris">
    <div class="d-flex ga-3 align-center">
      <v-text-field
        :model-value="searchInput"
        class="flex-grow-1 filters__search rounded-lg"
        density="compact"
        hide-details
        rounded="lg"
        placeholder="Rechercher un arrêt"
        prepend-inner-icon="mdi-magnify"
        type="search"
        variant="outlined"
        bg-color="rgba(255,255,255,.06)"
        @update:model-value="updateSearch($event ?? '')"
      />
      <v-btn
        variant="text"
        rounded="lg"
        :min-height="40"
        class="flex-shrink-0 border font-weight-medium"
        :aria-expanded="isOpen"
        aria-controls="favorites-filter-panel"
        @click="isOpen = !isOpen"
      >
        <v-icon icon="mdi-tune-variant" start aria-hidden="true" />
        Filtres
        <v-chip v-if="activeFilterCount" size="x-small" color="primary" class="ml-2 font-weight-bold">
          {{ activeFilterCount }}
        </v-chip>
        <v-icon :icon="isOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="18" end aria-hidden="true" />
      </v-btn>
    </div>

    <v-expand-transition>
      <div
        v-if="isOpen"
        id="favorites-filter-panel"
        class="d-grid ga-5 mt-3 pa-5 rounded-xl border border-opacity-10 filters__panel"
      >
        <div class="d-grid ga-2">
          <span class="filters__label text-caption font-weight-black text-uppercase opacity-70 ls-wide">Transport</span>
          <div class="d-flex flex-wrap ga-2" role="group" aria-label="Mode de transport">
            <v-btn
              v-for="mode in modes"
              :key="mode.id"
              size="small"
              rounded="lg"
              :variant="selectedMode === mode.id ? 'flat' : 'outlined'"
              :color="selectedMode === mode.id ? 'primary' : undefined"
              class="border-opacity-25"
              :aria-pressed="selectedMode === mode.id"
              @click="emit('update:selectedMode', mode.id)"
            >
              <v-icon :icon="mode.icon" size="16" start aria-hidden="true" />
              {{ mode.label }}
            </v-btn>
          </div>
        </div>

        <div class="d-grid ga-2">
          <span class="filters__label text-caption font-weight-black text-uppercase opacity-70 ls-wide">Groupe</span>
          <div class="d-flex flex-wrap ga-2" role="group" aria-label="Groupe de favoris">
            <v-btn
              v-for="group in groupOptions"
              :key="group.value"
              size="small"
              rounded="lg"
              :variant="selectedGroup === group.value ? 'flat' : 'outlined'"
              :color="selectedGroup === group.value ? 'primary' : undefined"
              class="border-opacity-25"
              :aria-pressed="selectedGroup === group.value"
              @click="emit('update:selectedGroup', group.value)"
            >
              {{ group.title }}
            </v-btn>
          </div>
        </div>

        <div class="d-flex flex-wrap align-center ga-4 pt-1">
          <v-switch
            :model-value="nearOnly"
            color="primary"
            density="compact"
            hide-details
            label="Départs dans les 15 min"
            @update:model-value="emit('update:nearOnly', !!$event)"
          />
          <v-select
            :model-value="sortBy"
            :items="sortOptions"
            item-title="title"
            item-value="value"
            density="compact"
            hide-details
            variant="outlined"
            rounded="lg"
            class="filters__sort"
            aria-label="Trier les favoris"
            @update:model-value="emit('update:sortBy', $event)"
          />
          <v-btn
            v-if="activeFilterCount"
            variant="text"
            size="small"
            class="opacity-80"
            @click="clearFilters"
          >
            Réinitialiser
          </v-btn>
        </div>
      </div>
    </v-expand-transition>
  </section>
</template>

<style scoped>
.ls-wide { letter-spacing: .06em; }

.filters__search :deep(.v-field) {
  border: 1px solid rgba(255, 255, 255, .11);
  box-shadow: none;
}

.filters__panel {
background: linear-gradient(135deg, rgba(255, 255, 255, .075), rgba(255, 255, 255, .025)); box-shadow: inset 0 1px rgba(255, 255, 255, .06)

}

.filters__sort {
  min-width: 200px;
}

@media (max-width: 460px) {
  .filters__sort { min-width: 0; flex: 1 1 100%; }
}
</style>