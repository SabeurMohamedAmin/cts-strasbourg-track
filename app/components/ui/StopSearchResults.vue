<!--
  StopSearchResults (Step 3.3)

  Renders the search result list (capped at max-results) or the
  « no results » message. Highlighting follows the keyboard focus index
  provided by the parent (useListKeyboardNav).

  Dumb component contract:
    props:  results       — matching stops
            focused-index — highlighted row (-1 = none)
            query         — the debounced query (drives visibility)
            searching     — true while a search is in flight
            max-results   — how many rows are rendered
    emits:  select(stopId)
-->
<script setup lang="ts">
/** Minimal stop shape needed to render a result row. */
interface SearchStop {
  stopId: string
  stopName: string
  modes: string[]
  routes: string[]
}

defineProps<{
  results: SearchStop[]
  focusedIndex: number
  query: string
  searching: boolean
  maxResults: number
}>()

const emit = defineEmits<{
  select: [stopId: string]
}>()
</script>

<template>
  <!-- Search results -->
  <v-list
    v-if="query && results.length"
    class="mt-1 rounded-lg elevation-1"
    density="compact"
    max-height="220"
    style="overflow-y:auto"
  >
    <v-list-item
      v-for="(stop, idx) in results.slice(0, maxResults)"
      :key="stop.stopId"
      :active="focusedIndex === idx"
      :prepend-icon="stop.modes.includes('tram') ? 'mdi-tram' : 'mdi-bus'"
      :title="stop.stopName"
      rounded
      @click="emit('select', stop.stopId)"
    >
      <!-- Line numbers served by this stop, e.g. « Lignes A · D · 10 » -->
      <v-list-item-subtitle v-if="stop.routes.length" class="text-caption">
        Lignes {{ stop.routes.slice(0, 6).join(' · ') }}
      </v-list-item-subtitle>
    </v-list-item>
  </v-list>

  <!-- No results -->
  <p
    v-else-if="query && !searching"
    class="text-caption text-medium-emphasis mt-2 mb-0"
  >
    Aucun arrêt pour « {{ query }} ».
  </p>
</template>

<style scoped>
/* Semi-translucent so the glass drawer shows through */
.v-list {
  background: rgba(var(--v-theme-surface), 0.5);
}
</style>
