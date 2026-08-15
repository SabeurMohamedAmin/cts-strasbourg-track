<script setup lang="ts">
import HorairesHeader from '~/components/horaires/HorairesHeader.vue'
import GeolocationDialog, { type GeolocationCoords } from '~/components/ui/GeolocationDialog.vue'
import PullToRefreshIndicator from '~/components/ui/PullToRefreshIndicator.vue'
import type { StopArrival, StopArrivalsResponse } from '~~/shared/types/stop'
import DepartureCard, { type Departure } from '~/components/horaires/DepartureCard.vue'
import { useNearestStops } from '~/composables/useNearestStops'
import { useStopsStore } from '~/stores/stops'
import { minutesUntil } from '~/utils/format'
import { searchStops } from '~/utils/stopSearch'
import { slugifyStopName } from '~~/shared/utils/slug'

const stopsStore = useStopsStore()
const selectedLandmark = ref<string | null>(null)
const showGeolocationDialog = ref(false)
const pageContainer = useTemplateRef<HTMLElement>('pageContainer')
const resultsSection = useTemplateRef<HTMLElement>('resultsSection')

// The global back-to-top button (AppBackToTop in the default layout)
// covers this page's scroll container automatically.

const {
  nearest,
  loading: nearbyLoading,
  error: locationError,
  location,
  findNearest,
} = useNearestStops()
const { setLocation } = useUserLocation()
const route = useRoute()

// ── First-visit geolocation suggestion ──
// On arrival, offer to locate the user so the page shows real nearby
// departures instead of the placeholder content. The dialog's "Plus tard"
// button acts as Skip; the choice is remembered for the browsing session
// only, so the prompt does not nag on every navigation back to this page.
// "Plus tard": session only — clears when the tab/app closes, so the
// suggestion comes back on the next visit.
const GEO_PROMPT_SKIPPED_KEY = 'geo-prompt-skipped'
// "Ne plus me demander": permanent — survives across visits. The user can
// still trigger geolocation manually via the shortcut button.
const GEO_PROMPT_NEVER_KEY = 'geo-prompt-never'

/**
 * ── Auto geolocation prompt: DISABLED for performance ──
 * The dialog used to auto-open on every first visit. Because the whole page
 * content is gated behind `geoPromptResolved`, the dialog's description text
 * became the LCP element and delayed the mobile LCP by ~2.8 s.
 *
 * TODO(geo-prompt): to re-activate the first-visit suggestion, set this flag
 * back to `true` — nothing else to change. The skip / never-ask persistence
 * (sessionStorage + localStorage keys above), the content gate and the
 * manual « Localiser les arrêts autour de moi » button all still work.
 * Ideal re-activation: open the dialog AFTER first paint (e.g. inside
 * onNuxtReady or after a small delay) so it never gates the LCP again.
 */
const AUTO_GEO_PROMPT_ENABLED = false

/**
 * Content gate. While false, everything below the shortcuts is NOT rendered
 * and NO station/departure request is sent: the geolocation dialog is the
 * only active element on the page. It flips to true as soon as the user
 * answers (position granted OR skipped), or immediately when the answer is
 * already known (coords in the URL, previous fix, skip earlier this session).
 */
const geoPromptResolved = ref(false)

onMounted(() => {
  // Auto prompt disabled: release the content gate immediately so the page
  // paints right away. Geolocation stays available through the shortcut
  // button, which opens the same dialog on demand.
  if (!AUTO_GEO_PROMPT_ENABLED) {
    geoPromptResolved.value = true
    return
  }

  const hasCoordsInUrl = Number.isFinite(Number(route.query.lat)) && Number.isFinite(Number(route.query.lon))
  const skippedThisSession = sessionStorage.getItem(GEO_PROMPT_SKIPPED_KEY) === '1'
  const neverAskAgain = localStorage.getItem(GEO_PROMPT_NEVER_KEY) === '1'

  if (hasCoordsInUrl || location.value || skippedThisSession || neverAskAgain) {
    geoPromptResolved.value = true
    return
  }
  showGeolocationDialog.value = true
})

const locationSubtitle = computed(() => {
  if (nearbyLoading.value) return 'Recherche des arrêts…'
  if (location.value) return `Précision d’environ ${Math.round(location.value.accuracy)} mètres`
  return 'Arrêts à proximité'
})
const locationActionLabel = computed(() => location.value
  ? `Actualiser ma position, précision actuelle d’environ ${Math.round(location.value.accuracy)} mètres`
  : 'Utiliser ma position précise pour trouver les arrêts à proximité')
function clearLocationError() { locationError.value = null }

async function locateAroundMe() {
  if (!import.meta.client || !navigator.geolocation) {
    locationError.value = 'La géolocalisation n’est pas disponible sur cet appareil.'
    return
  }

  // A successful fix in this app session means permission was already granted.
  // Refresh silently instead of showing our explanatory dialog again.
  if (location.value) {
    requestFreshPosition()
    return
  }

  // After a reload, ask the browser whether permission is still granted.
  // The Permissions API is not available in every browser, so unsupported
  // browsers safely fall back to the explanatory dialog.
  try {
    const permission = await navigator.permissions?.query({ name: 'geolocation' })
    if (permission?.state === 'granted') {
      requestFreshPosition()
      return
    }
  }
  catch {
    // Continue with the dialog when permission status cannot be queried.
  }

  showGeolocationDialog.value = true
}

function requestFreshPosition() {
  nearbyLoading.value = true
  locationError.value = null

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude, accuracy } = position.coords
      setLocation(latitude, longitude, accuracy)
      await updateNearbyResults(latitude, longitude)
      nearbyLoading.value = false
    },
    (error) => {
      nearbyLoading.value = false
      if (error.code === error.PERMISSION_DENIED) {
        showGeolocationDialog.value = true
        return
      }
      locationError.value = error.code === error.TIMEOUT
        ? 'Position précise introuvable. Réessayez dans quelques instants.'
        : 'Votre position est temporairement indisponible.'
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15_000,
    },
  )
}

async function handleGeolocationGranted(coords: GeolocationCoords) {
  // Reuse the fix the dialog just acquired. Requesting a second GPS fix
  // here used to double the perceived wait (two acquisitions back-to-back)
  // before anything loaded.
  setLocation(coords.latitude, coords.longitude, coords.accuracy)
  geoPromptResolved.value = true
  await updateNearbyResults(coords.latitude, coords.longitude)
}

function handleGeolocationDenied() {
  // The dialog explains how to re-enable permission in browser settings.
  // Browsers do not expose an API that opens those settings directly.
  locationError.value = null
}

function handleGeolocationDismissed() {
  // "Plus tard": do not re-open the suggestion for the rest of the session,
  // and release the content gate so the page renders with placeholders.
  sessionStorage.setItem(GEO_PROMPT_SKIPPED_KEY, '1')
  geoPromptResolved.value = true
  locationError.value = null
}

function handleGeolocationNeverAskAgain() {
  // "Ne plus me demander": permanent opt-out of the automatic suggestion.
  localStorage.setItem(GEO_PROMPT_NEVER_KEY, '1')
  geoPromptResolved.value = true
  locationError.value = null
}

async function updateNearbyResults(latitude: number, longitude: number) {
  // Only update the URL. The route watcher below is the SINGLE entry point
  // that fetches nearby stations (findNearest), which in turn triggers the
  // departures fetch: exactly one round of requests per location change.
  //
  // Replace every previous station/place query with the latest device
  // position. Nuxt serializes and URL-encodes these query values safely.
  await navigateTo({
    path: '/',
    query: {
      // Five decimals provide roughly one-metre precision while keeping the
      // shareable URL compact and avoiding raw GPS floating-point noise.
      lat: latitude.toFixed(5),
      lon: longitude.toFixed(5),
      place: 'Autour de moi',
      results: 'nearby',
    },
  }, { replace: true })
}

function formatDistance(distanceM: number): string {
  return distanceM < 1_000 ? `à ${Math.round(distanceM)} mètres` : `à ${(distanceM / 1_000).toFixed(1)} km`
}

interface Landmark {
  icon: string
  label: string
  description: string
  stopName: string
}

async function openLandmark(landmark: Landmark) {
  if (selectedLandmark.value) return
  selectedLandmark.value = landmark.label

  try {
    if (!stopsStore.stops.length) await stopsStore.fetchStops()

    const station = searchStops(stopsStore.stops, landmark.stopName, 1)[0]
    if (!station) {
      locationError.value = `L’arrêt ${landmark.label} est temporairement introuvable.`
      return
    }

    // Nuxt encodes the human-readable place label in the URL. Using the
    // station coordinates feeds the same ten-station flow as “Autour de moi”
    // and guarantees the chosen station is the first result (distance: 0 m).
    await navigateTo({
      path: '/',
      query: {
        lat: String(station.stopLat),
        lon: String(station.stopLon),
        place: landmark.label,
      },
    })
    await nextTick()
    resultsSection.value?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }
  catch {
    locationError.value = `Impossible de charger les arrêts proches de ${landmark.label}.`
  }
  finally {
    selectedLandmark.value = null
  }
}

interface StationDepartureGroup {
  stopId: string
  stopName: string
  distanceM: number | null
  servedLines: StopArrivalsResponse['servedLines']
  departures: Departure[]
}

const stationGroups = ref<StationDepartureGroup[]>([])
const departuresLoading = ref(false)
const resultStopName = ref<string | null>(null)
const explicitStopId = computed(() => typeof route.query.stop === 'string' ? route.query.stop : null)
const hasDepartureSource = computed(() => Boolean(explicitStopId.value || nearest.value.length))

watch(() => [route.query.lat, route.query.lon, route.query.results, geoPromptResolved.value] as const, async ([lat, lon, results]) => {
  // Lazy-loading gate: no station request before the user answers the dialog.
  if (!geoPromptResolved.value) return

  const latitude = Number(lat)
  const longitude = Number(lon)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return

  await findNearest(latitude, longitude, 10, 20_000)

  if (results === 'nearby') {
    await nextTick()
    resultsSection.value?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }
}, { immediate: true })

type DepartureSource = { stopId: string; stopName: string; distanceM: number | null }

function getDepartureSources(): DepartureSource[] {
  return explicitStopId.value
    ? [{ stopId: explicitStopId.value, stopName: '', distanceM: null }]
    : nearest.value.slice(0, 10)
}

async function fetchDepartures(sources = getDepartureSources(), { silent = false, force = false } = {}) {
  if (!sources.length) return

  // Silent refreshes (the 30 s timer below) keep the current cards on
  // screen instead of flashing the loading state on every tick.
  if (!silent) departuresLoading.value = true
  try {
    stationGroups.value = await Promise.all(sources.map(async station => {
      try {
        const queryParams: Record<string, any> = { limit: 30, window: 90 }
        if (force) {
          queryParams.refresh = '1'
          // Cache-buster: guarantees a forced pull-to-refresh always reaches
          // the server instead of the browser's HTTP cache.
          queryParams._t = Date.now()
        }
        const response = await $fetch<StopArrivalsResponse>(`/api/stops/${encodeURIComponent(station.stopId)}/arrivals`, {
          query: queryParams,
        })
        return {
          stopId: station.stopId,
          stopName: response.stopName,
          distanceM: station.distanceM,
          servedLines: response.servedLines,
          departures: mapArrivalsToDepartures(response.stopName, response.arrivals),
        }
      }
      catch {
        return { ...station, stopName: station.stopName || 'Arrêt indisponible', servedLines: [], departures: [] }
      }
    }))
    resultStopName.value = stationGroups.value[0]?.stopName ?? null
  }
  finally {
    if (!silent) departuresLoading.value = false
  }
}

async function refreshHomeData() {
  const latitude = Number(route.query.lat)
  const longitude = Number(route.query.lon)

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    await findNearest(latitude, longitude, 10, 20_000)
  }

  await fetchDepartures(undefined, { force: true })
}

const {
  pullDistance,
  progress: pullProgress,
  isReady: isPullReady,
  isVisible: isPullVisible,
  isRefreshing: isPullRefreshing,
} = usePullToRefresh(pageContainer, { onRefresh: refreshHomeData })

// `nearest` is always replaced wholesale by findNearest, so a plain watch is
// enough: `deep: true` only added unnecessary traversal work on every change.
watch([explicitStopId, nearest, geoPromptResolved], () => {
  // Same gate: no departures request before the user's choice.
  if (!geoPromptResolved.value) return
  fetchDepartures()
}, { immediate: true })

// ── Silent 30 s refresh ──
// The arrivals endpoint responds with scheduled times when live data is not
// ready within its budget, while the CTS request keeps warming the server
// cache in the background. This timer re-fetches so the cards actually
// upgrade to live times shortly after, and minute countdowns stay fresh.
const DEPARTURES_REFRESH_MS = 30_000
let departuresRefreshTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  departuresRefreshTimer = setInterval(() => {
    // Skip hidden tabs (saves battery and API quota) and the placeholder
    // state shown before any station is selected.
    if (document.visibilityState !== 'visible' || !hasDepartureSource.value) return
    fetchDepartures(undefined, { silent: true })
  }, DEPARTURES_REFRESH_MS)
})

onUnmounted(() => {
  clearInterval(departuresRefreshTimer)
})

function mapArrivalsToDepartures(stopName: string, arrivals: StopArrival[]): Departure[] {
  const byLine = new Map<string, StopArrival[]>()
  for (const arrival of arrivals) {
    const key = `${arrival.mode}:${arrival.lineLabel}`
    byLine.set(key, [...(byLine.get(key) ?? []), arrival])
  }

  return [...byLine.values()].map((lineArrivals) => {
    const byDestination = new Map<string, StopArrival[]>()
    for (const arrival of lineArrivals) {
      byDestination.set(arrival.destination, [...(byDestination.get(arrival.destination) ?? []), arrival])
    }
    const directions = [...byDestination.values()].map(items => items.sort((a, b) => a.scheduledArrival.localeCompare(b.scheduledArrival)))
    const first = directions[0]![0]!
    const opposite = directions[1]?.[0]

    return {
      mode: first.mode,
      line: first.lineLabel,
      badgeColor: `#${first.routeColor}`,
      stopName,
      destination: first.destination,
      nextMin: minutesUntil(first.scheduledArrival),
      thenMin: directions[0]?.[1] ? minutesUntil(directions[0][1].scheduledArrival) : undefined,
      oppositeDestination: opposite?.destination,
      oppositeNextMin: opposite ? minutesUntil(opposite.scheduledArrival) : undefined,
      oppositeThenMin: directions[1]?.[1] ? minutesUntil(directions[1][1].scheduledArrival) : undefined,
      nextIso: first.scheduledArrival,
      thenIso: directions[0]?.[1]?.scheduledArrival,
      oppositeNextIso: opposite?.scheduledArrival,
      oppositeThenIso: directions[1]?.[1]?.scheduledArrival,
      crowd: 3,
      accessible: true,
    }
  })
}

// ── Transport filter ──
// A single selected value keeps the interaction predictable and makes
// "Tous" an explicit option rather than an implicit combination.
const MODES = [
  { id: 'all', label: 'Tous', icon: 'mdi-transit-connection-variant', accent: '148, 163, 184' },
  { id: 'bus', label: 'Bus', icon: 'mdi-bus', accent: '102, 187, 106' },
  { id: 'tram', label: 'Tram', icon: 'mdi-tram', accent: '79, 195, 247' },
] as const
type ModeId = (typeof MODES)[number]['id']

const activeMode = ref<ModeId>('all')

// ── Departures ──
// TODO(data): replace with live arrivals from /api/stops/:id/arrivals
// for the nearest stop; the Departure shape was designed to map 1-to-1.
const DEPARTURES: Departure[] = [
  {
    mode: 'tram',
    line: 'A',
    badgeColor: '#E53935',
    destination: 'Illkirch Lixenbuhl',
    hint: '→ Gare · Universités',
    nextMin: 2,
    thenMin: 8,
    oppositeDestination: 'Parc des Sports',
    oppositeNextMin: 6,
    oppositeThenMin: 14,
    crowd: 3,
    accessible: true,
  },
  {
    mode: 'tram',
    line: 'B',
    badgeColor: '#1E88E5',
    destination: 'Hoenheim Gare',
    hint: '→ Parlement Européen · Conseil Europe',
    nextMin: 5,
    thenMin: 11,
    oppositeDestination: 'Lingolsheim Tiergaertel',
    oppositeNextMin: 3,
    oppositeThenMin: 10,
    crowd: 2,
    accessible: true,
  },
  {
    mode: 'tram',
    line: 'C',
    badgeColor: '#43A047',
    destination: 'Neuhof Rodolphe Reuss',
    hint: '→ Cathédrale · Centre historique',
    nextMin: 12,
    thenMin: 24,
    oppositeDestination: 'Gare Centrale',
    oppositeNextMin: 7,
    oppositeThenMin: 19,
    crowd: 1,
    touristPin: true,
  },
  {
    mode: 'tram',
    line: 'D',
    badgeColor: '#8E24AA',
    destination: 'Aristide Briand',
    nextMin: 18,
    oppositeDestination: 'Poteries',
    oppositeNextMin: 9,
    oppositeThenMin: 21,
    crowd: 4,
  },
  {
    mode: 'bus',
    line: 'L1',
    badgeColor: '#F57C00',
    destination: 'Gare Centrale',
    hint: '→ Esplanade · Wacken',
    nextMin: 4,
    thenMin: 16,
    oppositeDestination: 'Robertsau Lamproie',
    oppositeNextMin: 8,
    oppositeThenMin: 20,
    crowd: 2,
    accessible: true,
  },
  {
    mode: 'bus',
    line: '2',
    badgeColor: '#5C6BC0',
    destination: 'Campus d\'Illkirch',
    nextMin: 9,
    oppositeDestination: 'Elmerforst',
    oppositeNextMin: 13,
    oppositeThenMin: 28,
    crowd: 3,
    night: true,
  },
]

/**
 * Default content mirrors the exact structure used by nearby search results.
 * It keeps the homepage useful before the user shares a location while making
 * the transition to live data visually stable (same headers, badges and cards).
 */
const PLACEHOLDER_STATION_GROUPS: StationDepartureGroup[] = [
  {
    stopId: 'placeholder-homme-de-fer',
    stopName: 'Homme de Fer',
    distanceM: null,
    servedLines: [
      { routeId: 'placeholder-a', lineLabel: 'A', mode: 'tram', routeColor: 'E53935', routeTextColor: 'FFFFFF' },
      { routeId: 'placeholder-b', lineLabel: 'B', mode: 'tram', routeColor: '1E88E5', routeTextColor: 'FFFFFF' },
      { routeId: 'placeholder-c', lineLabel: 'C', mode: 'tram', routeColor: '43A047', routeTextColor: 'FFFFFF' },
      { routeId: 'placeholder-d', lineLabel: 'D', mode: 'tram', routeColor: '8E24AA', routeTextColor: 'FFFFFF' },
    ],
    departures: DEPARTURES.filter(departure => departure.mode === 'tram'),
  },
  {
    stopId: 'placeholder-gare-centrale',
    stopName: 'Gare Centrale',
    distanceM: null,
    servedLines: [
      { routeId: 'placeholder-l1', lineLabel: 'L1', mode: 'bus', routeColor: 'F57C00', routeTextColor: 'FFFFFF' },
      { routeId: 'placeholder-2', lineLabel: '2', mode: 'bus', routeColor: '5C6BC0', routeTextColor: 'FFFFFF' },
    ],
    departures: DEPARTURES.filter(departure => departure.mode === 'bus'),
  },
]

/** Departures matching the selected transport filter. */
const visibleStationGroups = computed(() => {
  const groups = hasDepartureSource.value ? stationGroups.value : PLACEHOLDER_STATION_GROUPS

  if (activeMode.value === 'all') return groups

  return groups
    .map(group => ({
      ...group,
      departures: group.departures.filter(departure => departure.mode === activeMode.value),
    }))
    .filter(group => group.departures.length > 0)
})


// ── Landmarks: locals, tourists and cross-border commuters (Kehl) ──
const LANDMARKS: Landmark[] = [
  { icon: 'mdi-tram', label: 'Homme de Fer', description: 'Centre-ville', stopName: 'Homme de Fer' },
  { icon: 'mdi-bank-outline', label: 'République', description: 'Place & correspondances', stopName: 'République' },
  { icon: 'mdi-train', label: 'Gare Centrale', description: 'Trains & transports', stopName: 'Gare Centrale' },
  { icon: 'mdi-soccer', label: 'Stade de la Meinau', description: 'Stade & événements', stopName: 'Krimmeri Stade de la Meinau' },
  { icon: 'mdi-train-car', label: 'Hœnheim Gare', description: 'Pôle multimodal', stopName: 'Hœnheim Gare' },
  { icon: 'mdi-home-city-outline', label: 'Petite France', description: 'Quartier historique', stopName: 'Saint-Thomas Finkwiller' },
]
</script>

<template>
  <!--
    HORAIRES — home page (premium dark design).
    Sections top to bottom: header → search → mode toggle → departures
    (with perturbation banner) → landmark quick access → "voir tous".
    All departure/weather data is MOCK for now — see TODO(data) markers.
  -->
  <div ref="pageContainer"
    class="horaires-page pb-2">
    <PullToRefreshIndicator :distance="pullDistance"
      :progress="pullProgress"
      :ready="isPullReady"
      :refreshing="isPullRefreshing"
      :visible="isPullVisible" />

    <GeolocationDialog v-model="showGeolocationDialog"
      @granted="handleGeolocationGranted"
      @denied="handleGeolocationDenied"
      @dismissed="handleGeolocationDismissed"
      @never-ask-again="handleGeolocationNeverAskAgain" />

    <HorairesHeader />

    <!-- ── Primary shortcuts ── -->
    <section class="section pa-2"
      aria-labelledby="shortcuts-heading">
      <h1 id="shortcuts-heading"
        class="sr-only">Actions rapides</h1>
      <div class="quick-actions d-flex flex-column flex-sm-row justify-space-between "
        aria-label="Actions rapides">
        <button type="button"
          class="quick-action quick-action--location"
          :class="{ 'quick-action--active': location }"
          :aria-label="locationActionLabel"
          :aria-busy="nearbyLoading"
          :disabled="nearbyLoading"
          @click="locateAroundMe">
          <span class="quick-action__icon"
            aria-hidden="true">
            <v-progress-circular v-if="nearbyLoading"
              indeterminate
              size="20"
              width="2" />
            <v-icon v-else
              :icon="location ? 'mdi-crosshairs-gps' : 'mdi-crosshairs'"
              size="21" />
          </span>
          <span class="quick-action__copy">
            <strong>Localiser les arrêts autour de moi</strong>
            <small>{{ locationSubtitle }}</small>
          </span>
          <v-spacer />
          <v-icon class="quick-action__arrow"
            :icon="location ? 'mdi-check-circle-outline' : 'mdi-chevron-right'"
            size="18"
            aria-hidden="true" />
        </button>

        <button type="button"
          class="quick-action quick-action--favorites"
          aria-label="Ouvrir mes arrêts favoris"
          @click="navigateTo('/favoris')">
          <span class="quick-action__icon"
            aria-hidden="true">
            <v-icon icon="mdi-star-outline"
              size="21" />
          </span>
          <span class="quick-action__copy">
            <strong>Mes favoris</strong>
            <small>Accès instantané</small>
          </span>
          <v-spacer />
          <v-icon class="quick-action__arrow"
            icon="mdi-chevron-right"
            size="18"
            aria-hidden="true" />
        </button>
      </div>
      <v-alert v-if="locationError"
        class="mt-2"
        closable
        density="compact"
        role="alert"
        type="warning"
        variant="tonal"
        @click:close="clearLocationError">
        {{ locationError }}
      </v-alert>
    </section>

    <!-- Waiting state: visible only while the geolocation dialog is open.
         Everything below is lazy: it renders (and fetches) after the answer. -->
    <section v-if="!geoPromptResolved"
      class="section px-2"
      aria-hidden="true">
      <v-skeleton-loader type="heading, list-item-two-line, list-item-two-line, list-item-two-line "
        class="content-skeleton h-100" />
    </section>

    <!-- ── Transport filter: all modes, bus or tram ── -->
    <section v-if="geoPromptResolved"
      ref="resultsSection"
      class="section px-2"
      aria-labelledby="filter-heading">
      <h2 id="filter-heading"
        class="sr-only">Filtrer les départs</h2>
      <div class="filter-row">
        <div class="mode-toggles"
          role="radiogroup"
          aria-label="Filtrer par type de transport">
          <button v-for="option in MODES"
            :key="option.id"
            type="button"
            class="mode-toggle"
            :class="{ 'mode-toggle--active': activeMode === option.id }"
            role="radio"
            :aria-checked="activeMode === option.id"
            @click="activeMode = option.id">
            <v-icon :icon="option.icon"
              size="16"
              aria-hidden="true" />
            {{ option.label }}
          </button>
        </div>
      </div>
      <div class="station-summary">
        <p class="nearest-stop"><v-icon icon="mdi-map-marker-radius-outline"
            size="15" /> <strong>{{ resultStopName ?? nearest[0]?.stopName ?? 'Homme de Fer' }}</strong> <span
            v-if="nearest[0]">{{ formatDistance(nearest[0].distanceM) }}</span></p>
        <span class="summary-divider"
          aria-hidden="true" />
        <span class="result-total"
          aria-live="polite">{{ visibleStationGroups.length }} station{{ visibleStationGroups.length > 1 ? 's' : ''
          }}</span>
      </div>
    </section>

    <!-- ── Next departures ── -->
    <section v-if="geoPromptResolved"
      class="section departures px-2"
      aria-labelledby="departures-heading"
      :aria-busy="departuresLoading">
      <h2 id="departures-heading"
        class="sr-only">Prochains départs</h2>

      <div v-if="departuresLoading"
        class="departure-loading"
        role="status"
        aria-live="polite">
        <v-progress-circular indeterminate
          size="22"
          width="2" />
        Chargement des prochains départs…
      </div>

      <div v-else-if="hasDepartureSource && !visibleStationGroups.length"
        class="departure-empty"
        role="status">
        <v-icon icon="mdi-timetable"
          size="28"
          aria-hidden="true" />
        Aucun départ prévu pour ce résultat.
      </div>

      <section v-for="group in visibleStationGroups"
        :key="group.stopId"
        class="station-departures"
        :aria-labelledby="`station-${group.stopId}`">
        <header
          class="station-departures__header position-sticky d-flex align-baseline justify-space-between py-4 px-2  gap-12">
          <div>
            <h3 :id="`station-${group.stopId}`">
              <div class="d-inline font-weight-thin font-italic me-2 text-title-medium  opacity-75">
                Arrêt
              </div>
              {{ group.stopName }}
            </h3>
            <span v-if="group.distanceM != null">
              {{ formatDistance(group.distanceM) }}
            </span>
          </div>
          <div class="d-flex align-center justify-end flex-wrap">
            <v-btn nuxt
              variant="plain"
              :ripple="false"
              :to="`/station/${slugifyStopName(group.stopName)}`"
              :aria-label="`Voir la fiche horaires de ${group.stopName}`"
              class="text-primary"
              append-icon="mdi-clock-outline"
              :title="`voir tous les horaires dedicated pour l'arrêt : ${group.stopName}`">
              Voir les Horaires
            </v-btn>
          </div>
        </header>
        <div v-if="group.servedLines.length"
          class="station-lines"
          :aria-label="`Lignes desservant ${group.stopName}`">
          <span v-for="line in group.servedLines"
            :key="line.routeId"
            class="station-line"
            :style="{ '--station-line-color': `#${line.routeColor}`, '--station-line-text': `#${line.routeTextColor}` }">
            {{ line.lineLabel }}
          </span>
        </div>
        <DepartureCard v-for="departure in group.departures"
          :key="`${group.stopId}-${departure.line}-${departure.destination}`"
          :departure="departure" />
        <p v-if="!group.departures.length"
          class="station-departures__empty">Aucun passage dans les 90 prochaines minutes.</p>
      </section>
    </section>

    <!-- ── Tourist / commuter quick access ── -->
    <section v-if="geoPromptResolved"
      class="section quick-access px-2"
      aria-labelledby="quick-heading">
      <div class="quick-heading">
        <div>
          <h2 id="quick-heading"
            class="quick-title my-2">Accès rapide</h2>
          <p class="quick-description mt-1 mb-2">Retrouvez les lieux les plus demandés</p>
        </div>
        <v-icon icon="mdi-map-marker-radius-outline"
          size="22"
          aria-hidden="true" />
      </div>

      <div class="landmarks"
        role="list">
        <button v-for="landmark in LANDMARKS"
          :key="landmark.label"
          type="button"
          class="landmark-card"
          role="listitem"
          :aria-label="`${landmark.label}, ${landmark.description}. Rechercher les départs`"
          :aria-busy="selectedLandmark === landmark.label"
          :disabled="selectedLandmark !== null"
          @click="openLandmark(landmark)">
          <span class="landmark-icon"
            aria-hidden="true">
            <v-progress-circular v-if="selectedLandmark === landmark.label"
              indeterminate
              size="20"
              width="2" />
            <v-icon v-else
              :icon="landmark.icon"
              size="21" />
          </span>
          <span class="landmark-copy">
            <strong>{{ landmark.label }}</strong>
            <small>{{ landmark.description }}</small>
          </span>
          <v-icon class="landmark-arrow"
            icon="mdi-chevron-right"
            size="19"
            aria-hidden="true" />
        </button>
      </div>
    </section>
    <NuxtLink v-if="geoPromptResolved"
      to="/live"
      class="see-all">
      Voir tous les départs →
    </NuxtLink>
  </div>
</template>



<style scoped>
/* Design tokens for this screen (inherited by child elements). */
.horaires-page {
  --accent: rgb(var(--v-theme-primary));
  --text-main: rgba(var(--v-theme-on-background), 0.92);
  --text-dim: rgba(var(--v-theme-on-background), 0.62);
  --glass: rgba(var(--v-theme-surface), 0.78);
  --glass-border: rgba(var(--v-theme-on-surface), 0.1);
  --accent-tint: 0.065;
  --accent-border: 0.3;
  --surface-shadow: 0.055;
  position: relative;
  flex: 1 1 0;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  touch-action: pan-y;
  color: var(--text-main);
  background: rgb(var(--v-theme-background));
  background:
    radial-gradient(circle at 50% -10%, rgba(var(--v-theme-primary), .055), transparent 30rem),
    rgb(var(--v-theme-background));
}

.section {
  width: min(100%, 960px);
  margin-inline: auto;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.shortcuts-section {
  border: 1px solid red;
}

.quick-actions {
  flex-grow: 1;
  gap: 10px;
  width: 100%;
}

.quick-action {
  --action-color: var(--v-theme-primary);
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: start;
  gap: 9px;
  min-height: 60px;
  padding: 9px 10px;
  border: 1px solid var(--glass-border);
  border-radius: 15px;
  color: var(--text-main);
  background:
    linear-gradient(135deg, rgba(var(--action-color), var(--accent-tint)), transparent 58%),
    var(--glass);
  text-align: left;
  cursor: pointer;
  transition: border-color 160ms ease, background-color 160ms ease, transform 160ms ease;
}

.quick-action--location {
  --action-color: 33, 150, 243;
}

.quick-action--active {
  border-color: rgba(var(--action-color), .3);
}

.quick-action:disabled {
  cursor: wait;
  opacity: .78;
}

.quick-action--favorites {
  --action-color: 245, 166, 35;
}

.quick-action__icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 11px;
  color: rgb(var(--action-color));
  background: rgba(var(--action-color), 0.09);
}

.quick-action__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.quick-action__copy strong {
  overflow: hidden;
  font-size: 0.78rem;
  font-weight: 750;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-action__copy small {
  overflow: hidden;
  color: var(--text-dim);
  font-size: 0.64rem;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-action__arrow {
  color: var(--text-dim);
  transition: transform 160ms ease;
}

@media (hover: hover) {
  .quick-action:hover {
    border-color: rgba(var(--action-color), var(--accent-border));
    background-color: rgba(var(--action-color), 0.035);
  }

  .quick-action:hover .quick-action__arrow {
    transform: translateX(2px);
  }
}

@media (max-width: 340px) {
  .quick-actions {
    grid-template-columns: 1fr;
  }
}

/* ── Mode toggle cards ──
   Each card tints itself with its own accent (--mode-accent, an R,G,B
   triplet injected inline from MODES). Active = tinted glass + glow +
   check badge; inactive = dimmed with a desaturated emoji. */
.filter-row {
  width: 100%;
}

.result-total {
  color: var(--text-dim);
  font-size: .72rem;
  font-weight: 700;
  white-space: nowrap;
}

.mode-toggles {
  display: flex;
  width: 100%;
  gap: 3px;
  padding: 3px;
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  background: rgba(var(--v-theme-surface), .58);
}

.mode-toggle {
  --mode-accent: 79, 195, 247;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  padding: 7px 11px;
  border-radius: 9px;
  color: var(--text-dim);
  background: transparent;
  border: 0;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.12s ease;
}

.mode-toggle:active {
  transform: scale(0.97);
}

.mode-toggle__icon {
  flex: 0 0 auto;
  color: var(--text-dim);
  opacity: 0.65;
  transition: color 0.2s ease, opacity 0.2s ease;
}

.mode-toggle__text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
}

.mode-toggle__label {
  color: var(--text-dim);
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.2;
  transition: color 0.2s ease;
}

.mode-toggle__count {
  color: var(--text-dim);
  font-size: 0.6875rem;
  opacity: 0.8;
}

.mode-toggle__check {
  margin-left: auto;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgb(var(--mode-accent));
  color: rgb(var(--v-theme-surface));
  opacity: 0;
  transform: scale(0.5);
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.mode-toggle--active {
  color: var(--text-main);
  background: rgba(var(--v-theme-on-surface), .1);
  box-shadow: 0 1px 4px rgba(0, 0, 0, .12);
}

.mode-toggle--active .mode-toggle__icon {
  color: rgb(var(--mode-accent));
  opacity: 1;
}

.mode-toggle--active .mode-toggle__label {
  color: var(--text-main);
}

.mode-toggle--active .mode-toggle__check {
  opacity: 1;
  transform: scale(1);
}

.quick-action:focus-visible,
.mode-toggle:focus-visible,
.nearby-station:focus-visible,
.perturbation-link:focus-visible,
.landmark-card:focus-visible,
.see-all:focus-visible {
  outline: 3px solid rgb(var(--v-theme-primary));
  outline-offset: 3px;
}

.landmark-card:hover {
  background: rgba(var(--v-theme-on-surface), 0.07);
}

.station-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 11px;
}

.nearest-stop {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--text-dim);
  font-size: .75rem;
  white-space: nowrap;
}

.nearest-stop strong {
  color: var(--text-main);
  font-weight: 700;
}

.nearest-stop span {
  margin-left: 2px;
  color: rgba(var(--v-theme-on-background), .44);
}

.summary-divider {
  height: 1px;
  flex: 1;
  background: rgba(var(--v-theme-on-background), .1);
}

/* ── Departures ── */
.departures {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.departure-loading,
.departure-empty {
  display: flex;
  min-height: 96px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 18px;
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  color: var(--text-dim);
  background: var(--glass);
  font-size: .8rem;
  text-align: center;
}

.station-departures {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-block: 4px 12px;
  z-index: 9
}

.station-departures+.station-departures {
  padding-top: 16px;
  border-top: 1px solid var(--glass-border);
}

.station-departures__header {
  top: 5px;
  z-index: 100;
  background: var(--glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);

  border-radius: 12px;
  border: 1px solid var(--glass-border);
}

.station-departures__header h3 {
  font-size: .92rem;
  font-weight: 800;
}

.station-departures__header span {
  color: var(--text-dim);
  font-size: .7rem;
}

.station-departures__header button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 0;
  color: rgb(var(--v-theme-primary));
  background: transparent;
  font-size: .72rem;
  font-weight: 750;
  cursor: pointer;
}

.station-departures__header button:focus-visible {
  outline: 3px solid rgb(var(--v-theme-primary));
  outline-offset: 4px;
}

.station-lines {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.station-line {
  display: inline-grid;
  min-width: 30px;
  height: 27px;
  padding-inline: 7px;
  place-items: center;
  border-radius: 8px;
  color: var(--station-line-text);
  background: var(--station-line-color);
  font-size: .75rem;
  font-weight: 850;
}

.station-departures__empty {
  padding: 16px;
  border-radius: 14px;
  color: var(--text-dim);
  background: var(--glass);
  font-size: .76rem;
  text-align: center;
}

.perturbation {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 13px;
  border-radius: 13px;
  background: rgba(var(--v-theme-warning), .075);
  border: 1px solid rgba(var(--v-theme-warning), .18);
}

.perturbation-icon {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 10px;
  color: rgb(var(--v-theme-warning));
  background: rgba(var(--v-theme-warning), .1);
}

.perturbation-copy {
  flex: 1;
  min-width: 0;
}

.perturbation-copy strong {
  font-size: .75rem;
}

.perturbation-text {
  margin-top: 1px;
  color: var(--text-dim);
  font-size: .7rem;
  line-height: 1.35;
}

.perturbation-link {
  background: none;
  border: none;
  color: rgb(var(--v-theme-warning));
  font-size: .72rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

/* ── Quick access ── */
.quick-access {
  padding-bottom: 2px;
}

.quick-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 8px;
  color: rgb(var(--v-theme-primary));
}

.quick-title {
  color: var(--text-main);
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.3;
}

.quick-description {
  color: var(--text-dim);
  font-size: 0.75rem;
  line-height: 1.4;
}

.landmarks {
  display: grid;
  grid-auto-columns: minmax(220px, 78%);
  grid-auto-flow: column;
  gap: 10px;
  overflow-x: auto;
  padding: 2px 2px 10px;
  scroll-snap-type: x proximity;
  scrollbar-color: rgba(var(--v-theme-on-surface), 0.25) transparent;
  scrollbar-width: thin;
}

.landmark-card {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: 11px;
  min-height: 68px;
  padding: 11px 12px;
  scroll-snap-align: start;
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  color: var(--text-main);
  background:
    linear-gradient(135deg, rgba(var(--v-theme-primary), var(--accent-tint)), transparent 55%),
    var(--glass);
  box-shadow: 0 4px 14px rgba(var(--v-theme-on-background), var(--surface-shadow));
  text-align: left;
  cursor: pointer;
  transition: background-color 160ms ease, border-color 160ms ease, transform 160ms ease;
}

.landmark-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 13px;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.085);
}

.landmark-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.landmark-copy strong {
  overflow: hidden;
  font-size: 0.8125rem;
  font-weight: 750;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.landmark-copy small {
  overflow: hidden;
  color: var(--text-dim);
  font-size: 0.6875rem;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.landmark-arrow {
  color: var(--text-dim);
  transition: transform 160ms ease;
}

@media (hover: hover) {
  .landmark-card:hover {
    border-color: rgba(var(--v-theme-primary), var(--accent-border));
    background-color: rgba(var(--v-theme-primary), 0.035);
  }

  .landmark-card:hover .landmark-arrow {
    transform: translateX(2px);
  }
}

@media (min-width: 720px) {
  .landmarks {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-auto-flow: row;
    overflow: visible;
  }
}

:global(.v-theme--dark) .horaires-page {
  --glass: rgba(var(--v-theme-surface), 0.66);
  --glass-border: rgba(var(--v-theme-on-surface), 0.075);
  --accent-tint: 0.035;
  --accent-border: 0.22;
  --surface-shadow: 0.035;
}

:global(.v-theme--dark) .mode-toggle--active {
  background: rgba(var(--mode-accent), 0.045);
  border-color: rgba(var(--mode-accent), 0.25);
  box-shadow: none;
}

:global(.v-theme--dark) .quick-action__icon,
:global(.v-theme--dark) .landmark-icon {
  filter: saturate(0.82);
}

@media (prefers-reduced-motion: reduce) {

  .quick-action,
  .quick-action__arrow,
  .landmark-card,
  .landmark-arrow {
    transition: none;
  }
}

/* Neutral skeleton shown while the geolocation dialog awaits an answer. */
.content-skeleton {
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  background: var(--glass);
}

/* ── See all ── */
.see-all {
  display: block;
  margin: 20px auto 0;
  width: fit-content;
  color: var(--accent);
  font-size: 0.9375rem;
  font-weight: 600;
  text-decoration: none;
}
</style>