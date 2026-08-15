<script setup lang="ts">
import { GROUP_COLORS, useFavoriteGroupsStore, type GroupColor } from '~/stores/favoriteGroups'
import { useStopsStore } from '~/stores/stops'
import DepartureCard, { type Departure } from '~/components/horaires/DepartureCard.vue'
import PullToRefreshIndicator from '~/components/ui/PullToRefreshIndicator.vue'
import { usePullToRefresh } from '~/composables/usePullToRefresh'
import { minutesUntil } from '~/utils/format'
import type { StopArrival } from '~~/shared/types/stop'

interface DepartureSummary extends Departure {
  realtime: boolean
}

const favoritesStore = useFavoriteGroupsStore()
const stopsStore = useStopsStore()
const pageContainer = useTemplateRef<HTMLElement>('pageContainer')
const arrivals = ref<Record<string, DepartureSummary[]>>({})
const stopNames = ref<Record<string, string>>({})
const loading = ref(true)
const liveMessage = ref('')
const { fetchFavoriteArrivals } = useFavoriteArrivals()

useHead({ title: 'Mes favoris' })

const favoriteIds = computed(() => [...favoritesStore.allFavoriteIds])
const groups = computed(() => favoritesStore.groups.map(group => ({
  ...group,
  colorHex: colorHex(group.color),
  stops: group.stopIds.map(id => ({
    id,
    name: stopNames.value[id] ?? stopsStore.stopsById.get(id)?.stopName ?? id,
    departures: arrivals.value[id] ?? [],
  })),
})).filter(group => group.stops.length))

let refreshTimer: ReturnType<typeof setInterval> | undefined

onMounted(async () => {
  favoritesStore.hydrate()
  // Panels always start collapsed; the user expands what they need.
  favoritesStore.collapseAll()
  loading.value = false
  await loadArrivals()

  refreshTimer = setInterval(() => {
    if (document.visibilityState === 'visible' && favoriteIds.value.length) {
      loadArrivals()
    }
  }, 30_000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})

async function refreshFavoritesData() {
  await loadArrivals(true)
}

const {
  pullDistance,
  progress: pullProgress,
  isReady: isPullReady,
  isVisible: isPullVisible,
  isRefreshing: isPullRefreshing,
} = usePullToRefresh(pageContainer, { onRefresh: refreshFavoritesData })

function colorHex(color: GroupColor) {
  return GROUP_COLORS.find(option => option.key === color)?.hex ?? '#757575'
}

async function loadArrivals(force = false) {
  if (!favoriteIds.value.length) return
  const responses = await fetchFavoriteArrivals(favoriteIds.value, 12, 90, force)
  for (const stopId of favoriteIds.value) {
    const response = responses[stopId]
    if (response) stopNames.value[stopId] = response.stopName
    arrivals.value[stopId] = mapArrivalsToCards(response?.stopName ?? stopNames.value[stopId] ?? stopId, response?.arrivals ?? [])
  }
}

function mapArrivalsToCards(stopName: string, stopArrivals: StopArrival[]): DepartureSummary[] {
  const byLine = new Map<string, StopArrival[]>()
  for (const arrival of stopArrivals) {
    const key = `${arrival.mode}:${arrival.lineLabel}`
    byLine.set(key, [...(byLine.get(key) ?? []), arrival])
  }

  return [...byLine.values()].map((lineArrivals) => {
    const byDestination = new Map<string, StopArrival[]>()
    for (const arrival of lineArrivals) {
      byDestination.set(arrival.destination, [...(byDestination.get(arrival.destination) ?? []), arrival])
    }

    const directions = [...byDestination.values()]
      .map(items => items.sort((a, b) => a.scheduledArrival.localeCompare(b.scheduledArrival)))
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
      realtime: lineArrivals.some(item => item.status === 'live'),
    }
  })
}

function openStop(stopId: string) {
  navigateTo({ path: '/', query: { stop: stopId } })
}

</script>

<template>
  <main ref="pageContainer" class="favorites-page">
    <PullToRefreshIndicator
      :distance="pullDistance"
      :progress="pullProgress"
      :ready="isPullReady"
      :refreshing="isPullRefreshing"
      :visible="isPullVisible"
    />
    <div class="page-glow" aria-hidden="true" />
    <div class="page-container">
      <header class="page-header">
        <div class="page-heading">
          <span class="page-eyebrow"><v-icon icon="mdi-star-four-points-outline" size="15" /> Vos trajets enregistrés</span>
          <h1>Mes favoris</h1>
          <p>Vos arrêts habituels et leurs prochains départs, réunis au même endroit.</p>
        </div>
        <v-btn variant="plain" nuxt class="manage-link" to="/favoris/gerer">
          <v-icon icon="mdi-tune-variant" size="19" />
          <span>Gérer mes favoris</span>
        </v-btn>
      </header>

      <div v-if="loading" class="page-state" role="status">
        <v-progress-circular color="primary" indeterminate size="28" width="3" />
        <p>Chargement de vos favoris…</p>
      </div>

      <section v-else-if="!favoriteIds.length" class="page-state empty-state">
        <span class="empty-icon"><v-icon icon="mdi-star-outline" size="42" /></span>
        <span class="page-eyebrow">Commencez votre sélection</span>
        <h2>Vos prochains départs commencent ici</h2>
        <p>Enregistrez vos arrêts habituels pour consulter leurs horaires en un coup d’œil.</p>
        <div class="empty-actions">
          <NuxtLink class="primary-link" to="/"><v-icon icon="mdi-magnify" size="19" /> Rechercher un arrêt</NuxtLink>
          <NuxtLink prefetch-on="visibility" class="secondary-link" to="/favoris/gerer">
            <v-icon icon="mdi-folder-plus-outline" size="19" />
            Créer un groupe
          </NuxtLink>
        </div>
      </section>

      <div v-else class="groups">
        <section v-for="group in groups" :key="group.id" class="group rounded-xl pa-2" :style="{ '--accent': group.colorHex }">
          <header class="group-header rounded-xl pa-2">
            <button
              class="group-toggle pa-3 rounded-xl border-0"
              type="button"
              :aria-expanded="!group.collapsed"
              :aria-controls="`favorite-group-${group.id}`"
              @click="favoritesStore.toggleCollapse(group.id)"
            >
              <v-icon
                class="group-toggle__icon"
                :class="{ 'group-toggle__icon--expanded': !group.collapsed }"
                icon="mdi-chevron-right"
                size="22"
                aria-hidden="true"
              />
              <span class="group-title">
                <i />
                <span>
                  <strong>
                    {{ group.name }}
                  </strong>
                  <small>
                    {{ group.stops.length }} arrêt{{ group.stops.length > 1 ? 's' : '' }} enregistré{{ group.stops.length > 1 ? 's' : '' }}
                  </small>
                </span>
              </span>
            </button>
          </header>

          <div v-show="!group.collapsed" :id="`favorite-group-${group.id}`" class="stop-grid">
            <section v-for="stop in group.stops" :key="stop.id" class="favorite-station" :aria-labelledby="`favorite-stop-${stop.id}`">
              <header class="favorite-station__header">
                <div>
                  <h3 :id="`favorite-stop-${stop.id}`">{{ stop.name }}</h3>
                  <small>{{ stop.departures.length }} ligne{{ stop.departures.length > 1 ? 's' : '' }} à venir</small>
                </div>
                <button type="button" :aria-label="`Voir les détails de ${stop.name}`" @click="openStop(stop.id)">
                  Voir les détails <v-icon icon="mdi-arrow-right" size="16" aria-hidden="true" />
                </button>
              </header>

              <div v-if="stop.departures.length" class="station-departures">
                <DepartureCard
                  v-for="departure in stop.departures"
                  :key="`${departure.mode}-${departure.line}`"
                  :departure="departure"
                />
              </div>
              <div v-else class="no-departure"><v-icon icon="mdi-clock-outline" size="17" /> Aucun départ dans les 90 prochaines minutes</div>
            </section>
          </div>
        </section>

        <NuxtLink class="add-card" to="/favoris/gerer"><span><v-icon icon="mdi-plus" size="24" /></span><div><strong>Ajouter des Favoris</strong><small>Recherchez une station et ajoutez-la à vos favoris</small></div><v-icon icon="mdi-chevron-right" /></NuxtLink>
      </div>
      <p class="sr-only" role="status" aria-live="polite">{{ liveMessage }}</p>
    </div>
  </main>
</template>

<style scoped>
.favorites-page{position:relative;height:100%;overflow-y:auto;color:rgb(var(--v-theme-on-background));background:rgb(var(--v-theme-background))}.page-glow{position:fixed;inset:0;pointer-events:none;background:radial-gradient(circle at 15% -10%,rgba(var(--v-theme-primary),.18),transparent 30rem),radial-gradient(circle at 100% 15%,rgba(80,116,255,.1),transparent 26rem)}.page-container{position:relative;width:min(1120px,100%);margin:auto;padding:48px 20px 130px}.page-header{display:flex;align-items:flex-start;justify-content:space-between;gap:28px}.page-heading{max-width:650px}.page-eyebrow{display:flex;align-items:center;gap:7px;color:rgb(var(--v-theme-primary));font-size:.75rem;font-weight:850;letter-spacing:.08em;text-transform:uppercase}.page-header h1{margin:8px 0 6px;font-size:clamp(2rem,5vw,3.25rem);line-height:1}.page-header p{margin:0;color:rgba(var(--v-theme-on-background),.62);font-size:1rem}.manage-link,.primary-link,.secondary-link,.summary-add{display:inline-flex;min-height:46px;align-items:center;justify-content:center;gap:8px;padding:0 17px;border-radius:14px;font-weight:750;text-decoration:none}.manage-link{flex-shrink:0;color:rgb(var(--v-theme-on-primary));background:rgb(var(--v-theme-primary));box-shadow:0 10px 26px rgba(var(--v-theme-primary),.22)}.summary{display:flex;align-items:center;gap:12px;margin-top:30px;padding:12px;border:1px solid rgba(var(--v-theme-on-surface),.1);background:rgba(var(--v-theme-surface),.7);box-shadow:inset 0 1px rgba(var(--v-theme-on-surface),.05)}.summary>div{display:flex;align-items:center;gap:10px;padding:4px 13px}.summary-icon{display:grid;width:38px;height:38px;place-items:center;border-radius:12px;color:rgb(var(--v-theme-primary));background:rgba(var(--v-theme-primary),.12)}.summary strong,.summary small{display:block}.summary strong{font-size:1.1rem}.summary small{color:rgba(var(--v-theme-on-surface),.55)}.summary-add{margin-left:auto;min-height:40px;color:rgb(var(--v-theme-primary));background:rgba(var(--v-theme-primary),.1)}.page-state{display:flex;min-height:330px;align-items:center;justify-content:center;flex-direction:column;gap:12px;margin-top:28px;text-align:center}.page-state p{margin:0;color:rgba(var(--v-theme-on-background),.62)}.empty-state{padding:44px 24px;border:1px solid rgba(var(--v-theme-on-surface),.11);border-radius:24px;background:linear-gradient(145deg,rgba(var(--v-theme-surface),.96),rgba(var(--v-theme-surface),.78));box-shadow:0 18px 44px rgba(0,0,0,.14)}.empty-icon{display:grid;width:76px;height:76px;place-items:center;margin-bottom:4px;border-radius:24px;color:rgb(var(--v-theme-primary));background:rgba(var(--v-theme-primary),.12)}.empty-state h2{margin:0;font-size:clamp(1.35rem,4vw,2rem)}.empty-state p{max-width:500px}.empty-actions{display:flex;gap:10px;margin-top:12px}.primary-link{color:rgb(var(--v-theme-on-primary));background:rgb(var(--v-theme-primary))}.secondary-link{color:rgb(var(--v-theme-primary));background:rgba(var(--v-theme-primary),.1)}.groups{display:grid;gap:20px;margin-top:24px}.group{overflow:hidden;border:1px solid rgba(var(--v-theme-on-surface),.12);background:linear-gradient(145deg,rgba(var(--v-theme-surface),.96),rgba(var(--v-theme-surface),.82));box-shadow:0 18px 44px rgba(0,0,0,.14),inset 0 1px rgba(var(--v-theme-on-surface),.06)}.group-header{display:flex;align-items:center;justify-content:space-between;gap:6px;border-bottom:1px solid rgba(var(--v-theme-on-surface),.09);background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 17%,transparent),transparent 58%)}.group-toggle{display:flex;min-width:0;flex:1;align-items:center;gap:8px;color:inherit;background:transparent;text-align:left;cursor:pointer}.group-toggle:hover{background:rgba(var(--v-theme-on-surface),.05)}.group-toggle__icon{flex-shrink:0;transition:transform .2s ease}.group-toggle__icon--expanded{transform:rotate(90deg)}.group-title{display:flex;min-width:0;align-items:center;gap:12px}.group-title>i{width:12px;height:12px;flex-shrink:0;border-radius:50%;background:var(--accent);box-shadow:0 0 0 5px color-mix(in srgb,var(--accent) 16%,transparent)}.group-title strong,.group-title small{display:block}.group-title strong{overflow:hidden;font-size:1.05rem;text-overflow:ellipsis;white-space:nowrap}.group-title small{margin-top:3px;color:rgba(var(--v-theme-on-surface),.55);font-size:.78rem}.group-manage{align-items:center; color:rgba(var(--v-theme-on-surface),.7);text-decoration:none}.group-manage:hover{color:rgb(var(--v-theme-on-surface));background:rgba(var(--v-theme-on-surface),.07)}.stop-grid{display:grid;gap:18px;padding:14px}.favorite-station{display:grid;gap:10px}.favorite-station+.favorite-station{padding-top:18px;border-top:1px solid rgba(var(--v-theme-on-surface),.1)}.favorite-station__header{display:flex;align-items:center;justify-content:space-between;gap:12px}.favorite-station__header h3{margin:0;font-size:.95rem;font-weight:800}.favorite-station__header small{color:rgba(var(--v-theme-on-surface),.52);font-size:.7rem}.favorite-station__header button{display:inline-flex;align-items:center;gap:5px;padding:0;border:0;color:rgb(var(--v-theme-primary));background:transparent;font:inherit;font-size:.72rem;font-weight:750;cursor:pointer}.station-departures{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.no-departure{display:flex;min-height:90px;align-items:center;justify-content:center;gap:7px;padding:16px;border:1px solid rgba(var(--v-theme-on-surface),.08);border-radius:16px;color:rgba(var(--v-theme-on-surface),.52);background:rgba(var(--v-theme-surface),.55);font-size:.78rem}.add-card{display:grid;grid-template-columns:46px minmax(0,1fr) auto;align-items:center;gap:13px;padding:16px 18px;border:1px dashed rgba(var(--v-theme-primary),.35);border-radius:17px;color:inherit;background:rgba(var(--v-theme-primary),.045);text-decoration:none}.add-card>span{display:grid;width:46px;height:46px;place-items:center;border-radius:14px;color:rgb(var(--v-theme-primary));background:rgba(var(--v-theme-primary),.12)}.add-card strong,.add-card small{display:block}.add-card small{margin-top:3px;color:rgba(var(--v-theme-on-surface),.55)}.add-card:hover{background:rgba(var(--v-theme-primary),.08)}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}:is(a,button):focus-visible{outline:3px solid rgb(var(--v-theme-primary));outline-offset:3px}@media(max-width:760px){.page-container{padding:72px 12px 100px}.page-header{align-items:stretch;flex-direction:column}.manage-link{width:fit-content}.summary{align-items:stretch;flex-wrap:wrap}.summary-add{width:100%;margin:0}.station-departures{grid-template-columns:1fr}.empty-actions{width:100%;flex-direction:column}.group-manage{font-size:0}.group-manage .v-icon{font-size:18px!important}}@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
