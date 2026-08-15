<script setup lang="ts">
import StationHeaderCard from '~/components/station/StationHeaderCard.vue'
import StationNextDepartures from '~/components/station/StationNextDepartures.vue'
import StationTimetable from '~/components/station/StationTimetable.vue'
import StationTimetableHeader from '~/components/station/StationTimetableHeader.vue'
import FavoriteListPicker from '~/components/stops/FavoriteListPicker.vue'
import { useNextDepartures } from '~/composables/useNextDepartures'
import { useNow } from '~/composables/useNow'
import { useStationLines } from '~/composables/useStationLines'
import { useStationSchedule } from '~/composables/useStationSchedule'
import { useStopArrivals } from '~/composables/useStopArrivals'
import { useFavoriteGroupsStore } from '~/stores/favoriteGroups'
import { formatServiceDate, hourInParis } from '~/utils/time'

/**
 * One station: its next departures and its full theoretical timetable.
 * The page wires the pieces together; the logic lives in the composables and
 * the markup in the two cards below.
 */
const route = useRoute()
const router = useRouter()
const stationSlug = computed(() => String(route.params.slug ?? ''))

// ── Data ──
const { schedule, error: scheduleError, isSwitching } = await useStationSchedule(stationSlug)
const {
  lines,
  selectedRouteId,
  selectedDirection,
  currentLine,
  currentDirection,
  directionLabels,
} = useStationLines(schedule)

/** GTFS id of the main platform: feeds the arrivals and the favourites. */
const stopId = computed(() => schedule.value?.stopId ?? null)
const { arrivals, pending: arrivalsPending } = useStopArrivals(stopId, { limit: 30, window: 240 })
const hasLiveData = computed(() => arrivals.value.some(arrival => arrival.status === 'live'))

/** Shared app clock (one timer, and the same instant on both sides of SSR). */
const { now: nowMs } = useNow()
const now = computed(() => new Date(nowMs.value))

const { departures } = useNextDepartures({
  line: currentLine,
  direction: currentDirection,
  arrivals,
  now,
})

// ── Display ──
const dateLabel = computed(() => formatServiceDate(schedule.value?.date ?? ''))
const currentHour = computed(() => hourInParis(now.value))

/** Stops of the selected direction, with the one we are reading flagged. */
const routeBarStops = computed(() =>
  (currentDirection.value?.stops ?? []).map(stop => ({
    ...stop,
    isCurrent: stop.slug === stationSlug.value,
  })),
)

// ── Favourites ──
const favorites = useFavoriteGroupsStore()
onMounted(() => favorites.hydrate())

const showFavoriteDialog = ref(false)
const isFavorite = computed(() => stopId.value ? favorites.isFavorite(stopId.value) : false)

function goBack() {
  if (import.meta.client && window.history.length > 1) router.back()
  else navigateTo('/')
}

useHead({ title: () => schedule.value ? `Horaires — ${schedule.value.stopName}` : 'Horaires' })
</script>

<template>
  <div class="station-page pb-16 pt-9 pt-md-0">
    <!-- ── Station not found ── -->
    <section v-if="scheduleError"
      class="station-section px-2 pt-4 pt-md-0">
      <v-alert type="warning"
        variant="tonal"
        role="alert"
        class="text-body-small text-sm-body-medium">
        Impossible de charger cette station. Elle n'existe peut-être plus.
      </v-alert>
      <v-btn class="mt-4"
        color="primary"
        variant="tonal"
        block
        @click="goBack">
        Retour à l'accueil
      </v-btn>
    </section>

    <template v-else-if="schedule">
      <!-- ── Station, lines, direction and stops ── -->
      <section class="station-section px-2 station-section-sticky"
        aria-labelledby="station-name"
        :aria-busy="isSwitching">
        <StationHeaderCard v-model:route-id="selectedRouteId"
          v-model:direction="selectedDirection"
          :stop-name="schedule.stopName"
          :lines="lines"
          :direction-labels="directionLabels"
          :stops="routeBarStops"
          :line-color="currentLine?.routeColor"
          :has-live-data="hasLiveData"
          :is-favorite="isFavorite"
          :can-favorite="!!stopId"
          :is-loading="isSwitching"
          @toggle-favorite="showFavoriteDialog = true" />
      </section>

      <FavoriteListPicker v-if="stopId"
        v-model="showFavoriteDialog"
        :stop-id="stopId"
        :stop-name="schedule.stopName" />

      <!-- ── Next departures ── -->
      <section class="station-section px-2 pt-2"
        aria-labelledby="next-heading">
        <p id="next-heading"
          class="text-label-small text-sm-label-medium text-uppercase font-weight-medium text-medium-emphasis ma-1 mt-2">
          Prochains passages
        </p>
        <StationNextDepartures :departures="departures"
          :pending="arrivalsPending" />
      </section>

      <!-- ── Full timetable ── -->
      <section class="station-section px-2 pt-2"
        aria-labelledby="timetable-heading">
        <StationTimetableHeader :date-label="dateLabel"
          :headsign="currentDirection?.headsign" />
        <StationTimetable :hours="currentDirection?.hours ?? []"
          :current-hour="currentHour" />
      </section>
    </template>

    <!-- ── First load: nothing to show yet ── -->
    <section v-else
      class="station-section px-2 pt-6 d-flex align-center justify-center"
      role="status"
      aria-live="polite">
      <v-progress-circular color="primary"
        indeterminate
        size="24"
        width="3" />
      <span class="ms-3 text-body-small text-sm-body-medium">Chargement des horaires…</span>
    </section>
  </div>
</template>

<style scoped>
.station-page {
  --glass-border: rgba(var(--v-theme-on-surface), .1);
  position: relative;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  background:
    radial-gradient(circle at 50% -10%, rgba(var(--v-theme-primary), .055), transparent 30rem),
    rgb(var(--v-theme-background));
}

/* Single layout token — every section shares it */
.station-section {
  width: min(100%, 960px);
  margin-inline: auto;
}

.station-section-sticky {
  position: sticky;
  top: 5px;
  z-index: 99;
}
</style>
