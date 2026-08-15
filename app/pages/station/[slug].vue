<script setup lang="ts">
import StationDirectionToggle from '~/components/station/StationDirectionToggle.vue'
import StationLineToggles from '~/components/station/StationLineToggles.vue'
import StationNextDepartures from '~/components/station/StationNextDepartures.vue'
import StationRouteBar from '~/components/station/StationRouteBar.vue'
import StationTimetable from '~/components/station/StationTimetable.vue'
import FavoriteListPicker from '~/components/stops/FavoriteListPicker.vue'
import { useStopArrivals } from '~/composables/useStopArrivals'
import { useFavoriteGroupsStore } from '~/stores/favoriteGroups'
import type { StopScheduleResponse } from '~~/shared/types/schedule'
import type { StopArrival } from '~~/shared/types/stop'


const route = useRoute()
const router = useRouter()
const stationSlug = computed(() => String(route.params.slug ?? ''))


// `lazy: true` keeps client-side navigation instant: the page shell and a
// loading state render immediately while the timetable downloads. Initial
// server-rendered visits still wait for the data (SEO unaffected).
const { data: schedule, error: scheduleError } = await useFetch<StopScheduleResponse>(
  () => `/api/stations/${encodeURIComponent(stationSlug.value)}/schedule`,
  { lazy: true },
)


const stopId = computed(() => schedule.value?.stopId ?? null)
const { arrivals, pending: arrivalsPending } = useStopArrivals(stopId, { limit: 30, window: 240 })
const hasLiveData = computed(() => arrivals.value.some(a => a.status === 'live'))


const lines = computed(() => schedule.value?.lines ?? [])
const selectedRouteId = ref('')


watch(lines, (list) => {
  if (!list.some(l => l.routeId === selectedRouteId.value))
    selectedRouteId.value = list[0]?.routeId ?? ''
}, { immediate: true })


const currentLine = computed(() => lines.value.find(l => l.routeId === selectedRouteId.value) ?? null)


const selectedDirection = ref(0)
watch(selectedRouteId, () => { selectedDirection.value = 0 })


const directionLabels = computed(() => currentLine.value?.directions.map(d => d.headsign) ?? [])
const currentDirection = computed(() => currentLine.value?.directions[selectedDirection.value] ?? null)


// Stops of the selected direction, flagged for the route bar. Building them in
// a computed (instead of inline in the template) keeps the array stable, so the
// bar only re-measures and re-centers when the line or direction changes.
const routeBarStops = computed(() =>
  (currentDirection.value?.stops ?? []).map(stop => ({
    ...stop,
    isCurrent: stop.slug === stationSlug.value,
  })),
)


const now = ref(new Date())
let clockTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => { clockTimer = setInterval(() => { now.value = new Date() }, 60_000) })
onUnmounted(() => clearInterval(clockTimer))


const parisSecondsSinceMidnight = computed(() => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now.value)
  const read = (unit: string) => Number(parts.find(p => p.type === unit)?.value ?? 0)
  return read('hour') * 3600 + read('minute') * 60 + read('second')
})


const currentHour = computed(() => Math.floor(parisSecondsSinceMidnight.value / 3600))


function normalizeLabel(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim()
}


const scheduledFallback = computed<StopArrival[]>(() => {
  const line = currentLine.value
  const direction = currentDirection.value
  if (!line || !direction) return []
  const nowSec = parisSecondsSinceMidnight.value
  const departures: StopArrival[] = []
  for (const row of direction.hours) {
    for (const minute of row.minutes) {
      const departureSec = row.hour * 3600 + minute * 60
      if (departureSec < nowSec) continue
      departures.push({
        tripId: `theoretical-${line.routeId}-${direction.directionId}-${row.hour}-${minute}`,
        lineLabel: line.lineLabel,
        destination: direction.headsign,
        scheduledArrival: new Date(now.value.getTime() + (departureSec - nowSec) * 1_000).toISOString(),
        mode: line.mode,
        routeColor: line.routeColor,
        routeTextColor: line.routeTextColor,
        status: 'scheduled',
      })
      if (departures.length === 2) return departures
    }
  }
  return departures
})


const nextDepartures = computed(() => {
  const line = currentLine.value
  const direction = currentDirection.value
  if (!line || !direction) return []
  const wanted = new Set(direction.headsigns.map(normalizeLabel))
  const upcoming = arrivals.value
    .filter(a => a.mode === line.mode && a.lineLabel === line.lineLabel && wanted.has(normalizeLabel(a.destination)))
    .slice(0, 2)
  return upcoming.length ? upcoming : scheduledFallback.value
})


const dateLabel = computed(() => {
  const [year, month, day] = (schedule.value?.date ?? '').split('-').map(Number)
  return year ? `${day}/${month}/${year}` : ''
})


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
    <!-- ── Error state ── -->
    <section v-if="scheduleError" class="station-section px-2 pt-4 pt-md-0">
      <v-alert
        type="warning"
        variant="tonal"
        role="alert"
        class="text-body-small text-sm-body-medium"
      >
        Impossible de charger cette station. Elle n'existe peut-être plus.
      </v-alert>
      <v-btn class="mt-4" color="primary" variant="tonal" block @click="goBack">
        Retour à l'accueil
      </v-btn>
    </section>


    <template v-else-if="schedule">


      <!-- ── Station card ── -->
      <section class="station-section px-2 station-section-sticky" aria-labelledby="station-name">
        <v-card rounded="lg" variant="flat" elevation="0" class="pa-4 station-section-card">
          <!-- Name + favourite -->
          <div class="d-flex align-center justify-start gap-3 mb-2">
            <v-card-title id="station-name" class="px-0">
              {{ schedule.stopName }}
            </v-card-title>
            <!-- Live status -->
            <div
              class="mx-2 live-pill text-label-small text-uppercase font-weight-bold ma-0"
              :class="{ 'live-pill--on': hasLiveData }"
              role="status"
            >
              <span class="live-pill__dot" aria-hidden="true" />
              {{ hasLiveData ? 'Temps réel' : 'Théorique' }}
            </div>

            <v-spacer/>
            <v-btn
              icon
              variant="text"
              density="comfortable"
              :color="isFavorite ? 'amber' : undefined"
              :aria-label="isFavorite ? 'Gérer les favoris' : 'Ajouter aux favoris'"
              :disabled="!stopId"
              @click="showFavoriteDialog = true"
            >
              <v-icon :icon="isFavorite ? 'mdi-star' : 'mdi-star-outline'" size="24" />
            </v-btn>
          </div>

          <!-- Line pills -->
          <div class="d-flex align-center gap-1 mb-1 opacity-75">
            <station-line-toggles v-model="selectedRouteId" :lines="lines" />
          </div>


          <!-- Direction toggle (inside the card, visually grouped) -->
          <template v-if="directionLabels.length">
            <v-divider class="mb-3" />
            <p
              class="text-label-small text-sm-label-medium text-uppercase font-weight-bold text-medium-emphasis mb-2"
              aria-hidden="true"
            >
              Direction
            </p>
            <station-direction-toggle
              v-model="selectedDirection"
              :directions="directionLabels"
              aria-label="Choisir la direction"
            />
          </template>

          <!-- ── Route bar ── -->
          <template v-if="routeBarStops.length">
            <v-divider class="mt-3" />
            <station-route-bar
              :stops="routeBarStops"
              :line-color="currentLine?.routeColor"
              class="mt-1"
            />
          </template>
        </v-card>
      </section>


      <!-- Favourite dialog -->
      <favorite-list-picker
        v-if="stopId"
        v-model="showFavoriteDialog"
        :stop-id="stopId"
        :stop-name="schedule.stopName"
      />


      <!-- ── Next departures ── -->
      <section class="station-section px-2 pt-2" aria-labelledby="next-heading">
        <p
          id="next-heading"
          class="text-label-small text-sm-label-medium text-uppercase font-weight-bold text-medium-emphasis mb-2"
        >
          Prochains passages
        </p>
        <station-next-departures :departures="nextDepartures" :pending="arrivalsPending" />
      </section>


      <!-- ── Timetable ── -->
      <section class="station-section px-2 pt-2" aria-labelledby="timetable-heading">
        <v-card
          rounded="lg"
          variant="outlined"
          elevation="0"
          class="timetable-header pa-2 mb-3"
        >
          <div class="d-flex align-start justify-space-between gap-3">
            <div>
              <h2
                id="timetable-heading"
                class="ma-0 text-title-large text-sm-headline-small font-weight-bold mb-1"
              >
                Horaires
              </h2>
              <p class="text-body-small text-sm-body-medium text-medium-emphasis my-0">
                Théoriques
              </p>
            </div>


            <v-chip
              v-if="dateLabel"
              color="error"
              variant="flat"
              rounded="pill"
              size="small"
              :aria-label="`Date des horaires : ${dateLabel}`"
            >
              {{ dateLabel }}
            </v-chip>
          </div>


          <v-divider v-if="currentDirection" class="my-3" />


          <div
            v-if="currentDirection"
            class="d-flex align-center gap-1 timetable-direction"
            role="status"
            aria-live="polite"
          >
            <v-icon icon="mdi-arrow-right-thin" size="18" color="primary" aria-hidden="true" />
            <span class="text-body-medium text-sm-body-large font-weight-medium">
              {{ currentDirection.headsign }}
            </span>
          </div>
        </v-card>


        <station-timetable :hours="currentDirection?.hours ?? []" :current-hour="currentHour" />
      </section>
    </template>

    <!-- ── Loading state (lazy fetch during client-side navigation) ── -->
    <section
      v-else
      class="station-section px-2 pt-6 d-flex align-center justify-center"
      role="status"
      aria-live="polite"
    >
      <v-progress-circular color="primary" indeterminate size="24" width="3" />
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


/* Single layout token — all sections share it */
.station-section {
  width: min(100%, 960px);
  margin-inline: auto;
}


.station-section-sticky {
  position: sticky;
  top: 5px;
  z-index: 99;
}


.station-section-card {
  backdrop-filter: blur(15px);
  background: rgba(var(--v-theme-surface), .4);
  box-shadow: 0 8px 24px rgba(0, 0, 0, .08);
  border: 1px solid rgba(var(--v-theme-on-surface), .1);
}


/* ── Timetable header card ── */
.timetable-header {
  border-color: rgba(var(--v-theme-on-surface), .1) !important;
  background: rgba(var(--v-theme-surface), .5);
}


.timetable-direction {
  color: rgba(var(--v-theme-on-surface), .85);
}


/* ── Live pill ── */
.live-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  border-radius: 999px;
  color: rgba(var(--v-theme-on-surface), .62);
  background: rgba(var(--v-theme-on-surface), .07);
  width: fit-content;
}
.live-pill__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}
.live-pill--on {
  color: #4caf50;
  background: rgba(76, 175, 80, .14);
}
.live-pill--on .live-pill__dot {
  animation: live-pulse 1.8s ease-out infinite;
}
@keyframes live-pulse {
  0%   { box-shadow: 0 0 0 0   rgba(76, 175, 80, .55); }
  70%  { box-shadow: 0 0 0 6px rgba(76, 175, 80, 0); }
  100% { box-shadow: 0 0 0 0   rgba(76, 175, 80, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .live-pill--on .live-pill__dot { animation: none; }
}
</style>