<script setup lang="ts">
import { useStopsStore } from '~/stores/stops'
import { useMapStore } from '~/stores/map'
import { useFavoriteGroupsStore } from '~/stores/favoriteGroups'
import { useLinesStore } from '~/stores/lines'
import { useStopArrivals } from '~/composables/useStopArrivals'
import { formatDistanceM } from '~/utils/format'
import StopSheetHeader from '~/components/stops/StopSheetHeader.vue'
import ServedLineChips from '~/components/stops/ServedLineChips.vue'
import ArrivalsList from '~/components/stops/ArrivalsList.vue'

// StopSheet is an ORCHESTRATOR: it wires the stores and the arrivals
// composable into dumb presentational components (Step 3.2):
//   StopSheetHeader — name, distance, favourite badge
//   ServedLineChips — line chips toggling route tracks on the map
//   ArrivalsList    — skeletons / empty state / ArrivalRow items
//   FavoriteListPicker — the favourite lists dialog (pre-existing)

const stopsStore = useStopsStore()
const mapStore = useMapStore()
const favStore = useFavoriteGroupsStore()
const linesStore = useLinesStore()

// ── Selected stop ─────────────────────────────────────────────
const stop   = computed(() => stopsStore.selectedStop)
const stopId = computed(() => stop.value?.stopId ?? null)

const servedLines = computed(() => {
  const routeIds = new Set(stop.value?.routes ?? [])
  return linesStore.lines
    .filter(line => routeIds.has(line.routeId))
    .slice()
    .sort((a, b) => a.routeShortName.localeCompare(b.routeShortName, 'fr', { numeric: true }))
})

// ── Favourite picker ───────────────────────────────────────────
const pickerOpen = ref(false)

/**
 * How many lists currently contain this stop.
 * Drives the v-badge count and filled vs outlined star icon.
 */
const listCount = computed(() => {
  if (!stop.value) return 0
  return favStore.groups.filter(g => g.stopIds.includes(stop.value!.stopId)).length
})

// Hydrate groups from localStorage when the sheet first mounts.
onMounted(favStore.hydrate)

// ── Arrivals ──────────────────────────────────────────────────
const { arrivals, pending, refresh } = useStopArrivals(stopId)

// ── Distance from user ─────────────────────────────────────────
const distanceLabel = computed(() => {
  const d = stopsStore.selectedStopDistance
  return d ? formatDistanceM(d) : null
})

/**
 * Line chip clicked: toggle the track visibility. Turning a line ON also
 * highlights its polyline and frames it on the map; turning it OFF clears
 * the highlight when it was the highlighted one.
 */
function onToggleLine(routeId: string) {
  const turningOn = !linesStore.isActive(routeId)
  linesStore.toggleLine(routeId)
  if (turningOn) mapStore.highlightRoute(routeId)
  else if (mapStore.highlightedRoute?.routeId === routeId) mapStore.clearHighlightedRoute()
}

function close() {
  pickerOpen.value = false
  mapStore.clearHighlightedRoute()
  stopsStore.clearSelectedStop()
}
function onToggle(open: boolean) { if (!open) close() }
</script>

<template>
  <!--
    Bottom sheet shown when the user taps a stop on the map or picks one
    from StopSearch.

    Favourite UX: the star in StopSheetHeader opens <FavoriteListPicker>
    where the user can tick / untick any existing list or create a new one
    inline. Everything is persisted to localStorage via
    useFavoriteGroupsStore and survives a full page refresh.
  -->
  <v-bottom-sheet
    :model-value="stop !== null"
    inset
    scrollable
    @update:model-value="onToggle"
  >
    <v-card v-if="stop" class="station-sheet" rounded="t-xl" elevation="16">
      <div class="sheet-handle" aria-hidden="true" />

      <StopSheetHeader
        :stop-name="stop.stopName"
        :distance-label="distanceLabel"
        :list-count="listCount"
        @open-picker="pickerOpen = true"
        @close="close"
      />

      <v-divider />

      <!-- Lines serving this station. Each chip directly toggles the
           corresponding coloured track on the map. -->
      <ServedLineChips
        v-if="servedLines.length"
        :lines="servedLines"
        :active-line-ids="[...linesStore.activeLineIds]"
        @toggle="onToggleLine"
      />

      <v-divider v-if="servedLines.length" />

      <!-- Upcoming departures -->
      <ArrivalsList
        :arrivals="arrivals"
        :pending="pending"
        @refresh="refresh"
      />

      <!-- Footer — reflects the data source actually displayed:
           green "Temps réel" rows come from the CTS SIRI feed,
           otherwise we fall back to the theoretical GTFS timetable. -->
      <v-card-actions class="station-footer px-4 py-2">
        <v-icon icon="mdi-information-outline" size="14" class="text-disabled mr-1" />
        <span class="text-caption text-disabled">
          {{ arrivals.some(a => a.status === 'live')
            ? 'Temps réel CTS (SIRI)'
            : 'Horaires théoriques CTS' }}
        </span>
      </v-card-actions>
    </v-card>
  </v-bottom-sheet>

  <!-- Favourite list picker dialog (rendered outside the sheet so z-index stacks correctly) -->
  <StopsFavoriteListPicker
    v-if="stop"
    v-model="pickerOpen"
    :stop-id="stop.stopId"
  />
</template>

<style scoped>
.station-sheet {
  width: min(680px, 100%);
  margin-inline: auto;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.3);
  /* Frosted glass: the map stays faintly visible behind the sheet.
     Kept fairly opaque (.82) so the timetable remains easy to read. */
  background: rgba(var(--v-theme-surface), 0.82);
  backdrop-filter: blur(22px) saturate(1.6);
  -webkit-backdrop-filter: blur(22px) saturate(1.6);
}
.sheet-handle {
  width: 42px;
  height: 4px;
  margin: 8px auto 4px;
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), .2);
}
.station-footer {
  min-height: 36px;
  background: rgba(var(--v-theme-on-surface), .025);
  border-top: 1px solid rgba(var(--v-border-color), .08);
}

@media (max-width: 600px) {
  .station-sheet { width: 100%; }
}
</style>
