<script setup lang="ts">
  /**
   * BlogFilterBar — search field, sort select and category chips grouped
   * in one outlined card, matching the app's filter panel design
   * (see FavoritesFilters).
   *
   * Categories are data-driven: the page derives them from the fetched
   * articles and passes them as a prop. The chips filter by category
   * SLUG (stable, locale-independent), never by display name.
   *
   * The state is owned by the blog page and bound here with three
   * `defineModel` (v-model:search / v-model:category / v-model:sort),
   * so this component stays purely presentational.
   *
   * The search text is debounced (250 ms): the page — and therefore the
   * URL — only update once the user stops typing.
   */
  import { SORT_OPTIONS, type BlogCategorySummary, type SortKey } from '~~/shared/types/blog'

  defineProps<{
    /** Categories shown as filter chips, already sorted by position. */
    categories: BlogCategorySummary[]
  }>()

  const search = defineModel<string>('search', { required: true })
  const category = defineModel<string | null>('category', { required: true })
  const sort = defineModel<SortKey>('sort', { required: true })

  // Local copy of the search text, pushed to the page after a short pause.
  const searchInput = ref(search.value)
  let searchTimer: ReturnType<typeof setTimeout> | undefined

  // Keep the local copy in sync when the page changes the search itself.
  watch(search, (value) => {
    if (value !== searchInput.value) searchInput.value = value
  })

  function updateSearch(value: string) {
    searchInput.value = value
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      search.value = value
    }, 250)
  }

  onBeforeUnmount(() => clearTimeout(searchTimer))

  /** Number of active filters, shown on the reset button. */
  const activeFilterCount = computed(() => [
    search.value.trim().length > 0,
    category.value !== null,
    sort.value !== 'recent',
  ].filter(Boolean).length)

  /** Back to the default view: no search, no category, most recent first. */
  function clearFilters() {
    clearTimeout(searchTimer)
    searchInput.value = ''
    search.value = ''
    category.value = null
    sort.value = 'recent'
  }
</script>

<template>
  <v-card
    variant="outlined"
    rounded="xl"
    class="pa-3 pa-sm-4 mb-4"
    tag="section"
    aria-label="Filtrer les articles"
  >
    <!-- Search + sorting: stacked on mobile, side by side from tablet up -->
    <v-row dense>
      <v-col cols="12" sm="8" md="9">
        <v-text-field
          :model-value="searchInput"
          type="search"
          label="Rechercher un article, un lieu, un arrêt…"
          prepend-inner-icon="mdi-magnify"
          variant="solo-filled"
          density="comfortable"
          rounded="lg"
          flat
          hide-details
          clearable
          @update:model-value="updateSearch($event ?? '')"
        />
      </v-col>
      <v-col cols="12" sm="4" md="3">
        <v-select
          v-model="sort"
          :items="SORT_OPTIONS"
          label="Trier par"
          prepend-inner-icon="mdi-sort"
          variant="solo-filled"
          density="comfortable"
          rounded="lg"
          flat
          hide-details
        />
      </v-col>
    </v-row>

    <v-divider class="my-3" />

    <!-- Section label + reset. The button is always rendered (disabled
         when there is nothing to clear) so the row never jumps. -->
    <div class="d-flex align-center justify-space-between">
      <span class="text-caption font-weight-bold text-uppercase text-medium-emphasis">
        Catégories
      </span>
      <v-btn
        variant="text"
        color="primary"
        size="small"
        prepend-icon="mdi-filter-off-outline"
        :disabled="!activeFilterCount"
        @click="clearFilters"
      >
        Réinitialiser
        <v-chip
          v-if="activeFilterCount"
          size="x-small"
          color="primary"
          variant="flat"
          class="ms-1 font-weight-bold"
        >
          {{ activeFilterCount }}
        </v-chip>
      </v-btn>
    </div>

    <!-- One chip per category. Tapping the active chip clears the filter. -->
    <v-chip-group
      v-model="category"
      color="primary"
      column
    >
      <v-chip
        v-for="item in categories"
        :key="item.slug"
        :value="item.slug"
        :prepend-icon="item.icon"
        size="small"
        variant="tonal"
        filter
      >
        {{ item.name }}
      </v-chip>
    </v-chip-group>
  </v-card>
</template>
