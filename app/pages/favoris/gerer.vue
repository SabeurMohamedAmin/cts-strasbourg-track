<script setup lang="ts">
  import { GROUP_COLORS, useFavoriteGroupsStore, type GroupColor } from '~/stores/favoriteGroups'
  import FavoritesManagementHeader from '~/components/favorites/FavoritesManagementHeader.vue'
  import FavoriteGroupForm from '~/components/favorites/FavoriteGroupForm.vue'
  import FavoritesFilters from '~/components/favorites/FavoritesFilters.vue'
  import FavoriteStopPickerDialog from '~/components/favorites/FavoriteStopPickerDialog.vue'
  import FavoriteGroupDeleteDialog from '~/components/favorites/FavoriteGroupDeleteDialog.vue'
  import FavoriteStopCard, { type ServedLine } from '~/components/favorites/FavoriteStopCard.vue'
  import type { LineDepartures } from '~/components/favorites/FavoriteLineRow.vue'
  import { useStopsStore, type Stop } from '~/stores/stops'
  import type { StopArrival } from '~~/shared/types/stop'

  /** A favourite stop enriched with everything the template needs. */
  interface FavoriteStopView {
    id: string
    name: string
    modes: Array<'tram' | 'bus'>
    groupId: string
    groupName: string
    /** Every line serving this stop (badge row). */
    servedLines: ServedLine[]
    /** Upcoming departures grouped by line, then by direction. */
    lines: LineDepartures[]
    loading: boolean
    unavailable: boolean
  }

  type TransportMode = 'all' | 'tram' | 'bus'
  type SortKey = 'custom' | 'departures' | 'name'

  /** Transport mode filter (segmented buttons). */
  const favoritesStore = useFavoriteGroupsStore()
  const stopsStore = useStopsStore()

  // ── Filter state ─────────────────────────────────────────────────────────
  const search = ref('')
  const selectedGroup = ref('all')
  const selectedMode = ref<TransportMode>('all')
  const nearOnly = ref(false)
  const sortBy = ref<SortKey>('custom')

  // ── Live departures per stop ─────────────────────────────────────────────
  const stopLines = ref<Record<string, LineDepartures[]>>({})
  const stopServedLines = ref<Record<string, ServedLine[]>>({})
  const loadingStops = ref(new Set<string>())
  const unavailableStops = ref(new Set<string>())
  const stopNames = ref<Record<string, string>>({})
  const stopModes = ref<Record<string, Array<'tram' | 'bus'>>>({})
  const { fetchFavoriteArrivals } = useFavoriteArrivals()

  // ── "New group" form visibility ─────────────────────────────────────────
  const isCreatingGroup = ref(false)
  const pickerGroupId = ref<string | null>(null)
  const groupPendingDeletion = ref<{ id: string; name: string } | null>(null)

  /** Announced to screen readers after an action (aria-live region). */
  const liveMessage = ref('')

  useHead({ title: 'Gérer mes favoris' })

  onMounted(async () => {
    favoritesStore.hydrate()
    // Panels always start collapsed; the user expands what they need.
    favoritesStore.collapseAll()
    await loadArrivals()
  })

  const uniqueFavoriteIds = computed(() => [...favoritesStore.allFavoriteIds])
  const totalFavorites = computed(() => uniqueFavoriteIds.value.length)
  const hasGroups = computed(() =>
    favoritesStore.groups.some(group => group.id !== 'default' || group.stopIds.length > 0),
  )

  function stopById(id: string): Stop | undefined {
    return stopsStore.stopsById.get(id)
  }

  function groupColor(color: GroupColor) {
    return GROUP_COLORS.find(option => option.key === color)?.hex ?? '#75809a'
  }

  const groups = computed(() => favoritesStore.groups.map(group => ({
    ...group,
    colorHex: groupColor(group.color),
    description: group.id === 'default'
      ? 'Arrêts sans groupe'
      : group.name.toLowerCase().includes('quotidien')
        ? 'Maison, travail et correspondances'
        : group.name.toLowerCase().includes('loisir')
          ? 'Sorties, sport et week-ends'
          : 'Vos arrêts enregistrés',
  })))

  /** Items for the group <v-select>, with an "all groups" first entry. */
  const groupOptions = computed(() => [
    { value: 'all', title: 'Tous les groupes' },
    ...groups.value.map(group => ({ value: group.id, title: group.name })),
  ])

  /** Earliest upcoming departure of a stop, in minutes (Infinity when none). */
  function nextDepartureMin(stop: FavoriteStopView): number {
    const minutes = stop.lines.flatMap(line => line.directions.map(direction => direction.nextMin))
    return minutes.length ? Math.min(...minutes) : Infinity
  }

  const visibleGroups = computed(() => groups.value
    .filter(group => selectedGroup.value === 'all' || group.id === selectedGroup.value)
    .map((group) => {
      let stops: FavoriteStopView[] = group.stopIds.map((id) => {
        const stop = stopById(id)
        return {
          id,
          name: stopNames.value[id] ?? stop?.stopName ?? id,
          modes: stopModes.value[id] ?? stop?.modes ?? [],
          groupId: group.id,
          groupName: group.name,
          servedLines: stopServedLines.value[id] ?? [],
          lines: stopLines.value[id] ?? [],
          loading: loadingStops.value.has(id),
          unavailable: unavailableStops.value.has(id),
        }
      })

      const query = search.value.trim().toLocaleLowerCase('fr')
      if (query) stops = stops.filter(stop => stop.name.toLocaleLowerCase('fr').includes(query))
      // Capture the ref value in a constant so TypeScript narrows 'all' away
      // before the filter callback (narrowing is lost inside closures).
      const mode = selectedMode.value
      if (mode !== 'all') stops = stops.filter(stop => stop.modes.includes(mode))
      if (nearOnly.value) stops = stops.filter(stop => nextDepartureMin(stop) <= 15)
      if (sortBy.value === 'name') stops.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      if (sortBy.value === 'departures') stops.sort((a, b) => nextDepartureMin(a) - nextDepartureMin(b))
      return { ...group, stops }
    }))

  const visibleStopCount = computed(() => visibleGroups.value.reduce((sum, group) => sum + group.stops.length, 0))
  const hasActiveFilters = computed(() =>
    Boolean(search.value.trim()) || selectedGroup.value !== 'all' || selectedMode.value !== 'all' || nearOnly.value)

  function minutesUntil(isoTime: string) {
    return Math.max(0, Math.round((new Date(isoTime).getTime() - Date.now()) / 60_000))
  }

  /**
   * Group raw arrivals by line, then by direction (destination).
   * Each direction keeps its next two departures (next + "prochain").
   */
  function mapLineDepartures(stopArrivals: StopArrival[]): LineDepartures[] {
    const byLine = new Map<string, StopArrival[]>()
    for (const arrival of stopArrivals) {
      const key = `${arrival.mode}:${arrival.lineLabel}`
      byLine.set(key, [...(byLine.get(key) ?? []), arrival])
    }

    return [...byLine.values()]
      .map((lineArrivals) => {
        const byDestination = new Map<string, StopArrival[]>()
        for (const arrival of lineArrivals) {
          byDestination.set(arrival.destination, [...(byDestination.get(arrival.destination) ?? []), arrival])
        }

        const directions = [...byDestination.values()]
          .map(items => items.sort((a, b) => a.scheduledArrival.localeCompare(b.scheduledArrival)))
          // A card shows at most the two directions of the line.
          .slice(0, 2)
          .map(items => ({
            destination: items[0]!.destination,
            nextMin: minutesUntil(items[0]!.scheduledArrival),
            thenMin: items[1] ? minutesUntil(items[1].scheduledArrival) : undefined,
          }))

        const first = lineArrivals[0]!
        return {
          label: first.lineLabel,
          color: `#${first.routeColor}`,
          mode: first.mode,
          realtime: lineArrivals.some(item => item.status === 'live'),
          directions,
        }
      })
      // Stable, human-friendly order: A, B, C, C8, 10, 70…
      .sort((a, b) => a.label.localeCompare(b.label, 'fr', { numeric: true }))
  }

  async function loadArrivals() {
    const ids = uniqueFavoriteIds.value
    if (!ids.length) return
    loadingStops.value = new Set(ids)

    try {
      // 12 departures per stop so each line/direction gets a "prochain" time.
      const responses = await fetchFavoriteArrivals(ids, 12, 90)
      for (const stopId of ids) {
        const response = responses[stopId]
        if (!response) {
          unavailableStops.value.add(stopId)
          continue
        }
        stopNames.value[stopId] = response.stopName
        stopModes.value[stopId] = [...new Set(response.servedLines.map(line => line.mode))]
        stopServedLines.value[stopId] = response.servedLines.map(line => ({
          label: line.lineLabel,
          color: `#${line.routeColor}`,
          mode: line.mode,
        }))
        stopLines.value[stopId] = mapLineDepartures(response.arrivals)
      }
    }
    finally {
      loadingStops.value = new Set()
    }
  }

  function startCreatingGroup() {
    isCreatingGroup.value = true
  }

  function submitNewGroup(name: string, color: GroupColor) {
    favoritesStore.createGroup(name, color)
    isCreatingGroup.value = false
    liveMessage.value = `Groupe ${name} créé.`
  }

  function requestGroupDeletion(group: { id: string; name: string }) {
    groupPendingDeletion.value = { id: group.id, name: group.name }
  }

  function cancelGroupDeletion() {
    groupPendingDeletion.value = null
  }

  function confirmGroupDeletion() {
    const group = groupPendingDeletion.value
    if (!group) return

    favoritesStore.deleteGroup(group.id)
    liveMessage.value = `Groupe ${group.name} supprimé.`
    groupPendingDeletion.value = null
  }

  const pickerGroup = computed(() => groups.value.find(group => group.id === pickerGroupId.value) ?? null)

  async function openStopPicker(groupId: string) {
    pickerGroupId.value = groupId
    // The full GTFS catalog is only needed for search inside this dialog.
    if (!stopsStore.stops.length) await stopsStore.fetchStops().catch(() => undefined)
  }

  async function addStopToPickerGroup(stopId: string) {
    if (!pickerGroup.value) return
    favoritesStore.addStop(stopId, pickerGroup.value.id)
    liveMessage.value = `Arrêt ajouté au groupe ${pickerGroup.value.name}. Vous pouvez continuer à ajouter des arrêts.`
    // Fetch departures for the freshly added stop so its card fills in.
    await loadArrivals()
  }

  function removeFavorite(stop: FavoriteStopView) {
    favoritesStore.removeStop(stop.id, stop.groupId)
    liveMessage.value = `${stop.name} retiré des favoris.`
  }

  function openStop(stopId: string) {
    navigateTo({ path: '/', query: { stop: stopId } })
  }

  function clearFilters() {
    search.value = ''
    selectedGroup.value = 'all'
    selectedMode.value = 'all'
    nearOnly.value = false
  }
</script>

<template>
  <!-- h-100 + overflow-y-auto gives the page its own scroll container. -->
  <main class="h-100 overflow-y-auto">
    <!-- Subtle primary radial glow behind content -->
    <div class="page-glow" aria-hidden="true" />

    <div class="page-container w-100 mx-auto py-18 px-3">

      <favorites-management-header :total-favorites="totalFavorites" @create-group="startCreatingGroup" />

      <favorite-group-form v-model="isCreatingGroup" @submit="submitNewGroup" />

      <favorites-filters
        v-if="hasGroups"
        v-model:search="search"
        v-model:selected-group="selectedGroup"
        v-model:selected-mode="selectedMode"
        v-model:near-only="nearOnly"
        v-model:sort-by="sortBy"
        :group-options="groupOptions"
      />

      <!-- ── Empty state: no favourites yet ───────────────────────────── -->
      <v-card
        v-if="!hasGroups"
        tag="section"
        class="d-flex flex-column align-center ga-3 pa-12 rounded-xl text-center"
        variant="outlined"
        aria-labelledby="empty-title"
      >
        <span
          class="d-grid place-items-center align-content-center rounded-xl text-primary mb-2"
          style="width:70px; height:70px; background:rgba(var(--v-theme-primary),.10);"
          aria-hidden="true"
        >
          <v-icon icon="mdi-star-outline" size="36" />
        </span>
        <h2 id="empty-title" class="text-h6 font-weight-bold ma-0">
          Vos prochains départs commencent ici
        </h2>
        <p class="text-body-2 text-medium-emphasis ma-0" style="max-width:480px;">
          Enregistrez vos arrêts habituels pour consulter leurs horaires en un coup d'œil.
        </p>
        <v-btn prepend-icon="mdi-magnify" color="primary" variant="tonal" :min-height="36" rounded="lg" to="/" nuxt class="mt-2">
          Rechercher un arrêt
        </v-btn>
        <v-btn
          variant="tonal"
          :min-height="36"
          to="/?results=nearby"
          nuxt
          class="text-medium-emphasis"
          prepend-icon="mdi-crosshairs"
        >
          Découvrir les arrêts autour de moi
        </v-btn>
      </v-card>

      <!-- ── Empty state: filters match nothing ───────────────────────── -->
      <v-card
        v-else-if="hasActiveFilters && !visibleStopCount"
        tag="section"
        class="d-flex flex-column align-center ga-3 pa-12 rounded-xl text-center text-medium-emphasis"
        variant="outlined"
        role="status"
      >
        <v-icon icon="mdi-magnify-close" size="30" aria-hidden="true" />
        <h2 class="text-h6 font-weight-bold ma-0">
          Aucun favori ne correspond<span v-if="search"> à «&nbsp;{{ search }}&nbsp;»</span>.
        </h2>
        <v-btn variant="tonal" color="primary" :min-height="44" rounded="lg" class="mt-2" @click="clearFilters">
          Effacer la recherche et les filtres
        </v-btn>
      </v-card>

      <!-- ── Favourite groups ──────────────────────────────────────────── -->
      <section v-else class="d-grid " aria-label="Groupes de favoris">
        <article
          v-for="group in visibleGroups"
          :key="group.id"
          class="group-panel rounded-xl mb-2 overflow-hidden pa-2"
          :style="{ '--group-color': group.colorHex }"
        >

          <!-- Group header row -->
          <header class="group-panel__header rounded-xl d-flex align-center ga-3 pa-2">
            <button
              class="d-flex flex-grow-1 align-center ga-2 pa-3 text-left rounded-xl"
              type="button"
              style="min-height:56px; min-width:0; border:0; background:transparent; color:inherit; cursor:pointer;"
              :aria-expanded="!group.collapsed"
              :aria-controls="`group-${group.id}`"
              @click="favoritesStore.toggleCollapse(group.id)"
            >
              <v-icon
                :icon="group.collapsed ? 'mdi-chevron-right' : 'mdi-chevron-down'"
                aria-hidden="true"
              />
              <span>
                <h2 class="text-body-1 font-weight-bold ma-0" style="overflow-wrap:anywhere;">
                  {{ group.name }}
                </h2>
                <small class="text-caption text-medium-emphasis">
                  {{ group.description }}
                </small>
              </span>
            </button>

            <v-chip size="small" class="group-panel__count" variant="tonal">
              {{ group.stops.length }} arrêt{{ group.stops.length !== 1 ? 's' : '' }}
            </v-chip>

            <v-btn
              v-if="group.id !== 'default'"
              icon="mdi-delete-outline"
              variant="text"
              size="small"
              class="group-panel__delete"
              :aria-label="`Supprimer le groupe ${group.name}`"
              @click="requestGroupDeletion(group)"
            />
          </header>

          <!-- Stop cards -->
          <div
            v-show="!group.collapsed"
            :id="`group-${group.id}`"
            class="pa-3"
          >
            <!--
              ── Stop cards with add/remove animation ────────────────────
              TransitionGroup animates cards entering (added favourite),
              leaving (removed favourite) and moving (list reflow).
            -->
            <transition-group name="stop-card" tag="div" class="position-relative">
              <favorite-stop-card
                v-for="stop in group.stops"
                :key="stop.id"
                class="mb-3"
                :stop-name="stop.name"
                :modes="stop.modes"
                :served-lines="stop.servedLines"
                :lines="stop.lines"
                :loading="stop.loading"
                :unavailable="stop.unavailable"
                @open="openStop(stop.id)"
                @remove="removeFavorite(stop)"
              />
            </transition-group>
            <!-- ── button to add stops ──────────────────────────────────────────── -->
            <div class="d-flex flex-column align-center justify-center group-panel__empty text-body-2 text-medium-emphasis text-center pa-7">
              <span v-if="group.stops.length === 0" class="my-2">Ce groupe est prêt à accueillir vos arrêts.</span>
              <span v-else class="my-2">Ajoutez des arrêts à ce groupe.</span>
              <v-btn
                color="primary"
                variant="tonal"
                prepend-icon="mdi-plus"
                @click="openStopPicker(group.id)"
              >
                Ajouter un arrêt
              </v-btn>
            </div>
          </div>
        </article>
      </section>
    </div><!-- /page-container -->

    <favorite-group-delete-dialog
      :model-value="Boolean(groupPendingDeletion)"
      :group-name="groupPendingDeletion?.name ?? ''"
      @update:model-value="(isOpen) => { if (!isOpen) cancelGroupDeletion() }"
      @confirm="confirmGroupDeletion"
    />

    <favorite-stop-picker-dialog
      :model-value="Boolean(pickerGroup)"
      :group-name="pickerGroup?.name ?? ''"
      :stops="stopsStore.stops"
      :selected-stop-ids="pickerGroup?.stopIds ?? []"
      @update:model-value="(isOpen) => { if (!isOpen) pickerGroupId = null }"
      @select="addStopToPickerGroup"
    />

    <!-- Screen-reader announcements for create / remove actions. -->
    <p class="sr-only" role="status" aria-live="polite">{{ liveMessage }}</p>
  </main>
</template>

<style scoped>
/*
 * Only structural rules that have no Vuetify utility equivalent are kept here.
 * Everything else (spacing, colour, typography, flex/grid basics) is handled
 * with Vuetify utility classes in the template.
 * The stop card itself lives in components/favorites/FavoriteStopCard.vue.
 */

/* ── Page-level background ───────────────────────────────────────────── */
main {
  color: rgb(var(--v-theme-on-background));
  background:
    radial-gradient(circle at 15% -10%, rgba(var(--v-theme-primary), .18), transparent 30rem),
    radial-gradient(circle at 100% 15%, rgba(80, 116, 255, .1), transparent 26rem),
    rgb(var(--v-theme-background));
}

/* ── Page container: max-width + responsive padding ─────────────────── */
.page-container {
  max-width: 1120px;
  /* Top clears the floating menu button; bottom clears the navigation. */
  padding-top: 72px;
  padding-bottom: 130px;
  /* Calm reading rhythm: fluid rem-based size, relaxed line-height. */
  font-size: clamp(.95rem, .9rem + .25vw, 1.0625rem);
  line-height: 1.6;
}

@media (min-width: 900px) {
  .page-container { padding-top: 36px; }
}

@media (max-height: 520px) and (orientation: landscape) {
  .page-container { padding-top: 64px; padding-bottom: 96px; }
}
/* ── Premium dark group surfaces ─────────────────────────────────────── */
/****** SCROLL */

.group-panel {
  border: 1px solid rgba(var(--v-theme-on-surface), .12);
  background: linear-gradient(145deg, rgba(var(--v-theme-surface), .96), rgba(var(--v-theme-surface), .82));
  box-shadow: 0 18px 44px rgba(0, 0, 0, .14), inset 0 1px rgba(var(--v-theme-on-surface), .06);
  border-radius: 16px;
  max-height: 90dvh;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
  padding-right: 4px;

  scrollbar-width: thin;
  scrollbar-color: rgba(var(--v-theme-on-surface), .45) transparent;
}

.group-panel::-webkit-scrollbar {
  width: 6px;
}

.group-panel::-webkit-scrollbar-track {
  background: transparent;
  margin: 6px 0;
  border-radius: 999px;
}

.group-panel::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-on-surface), .45);
  border-radius: 999px;
  border: 1px solid transparent;
  background-clip: content-box;
  transition: background .18s ease;
}

.group-panel::-webkit-scrollbar-thumb:hover {
  background: rgb(var(--v-theme-on-surface));
  background-clip: content-box;
}

@media (min-width: 960px) {
  .group-panel {
    scrollbar-width: auto;
  }

  .group-panel::-webkit-scrollbar {
    width: 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .group-panel::-webkit-scrollbar-thumb {
    transition: none;
  }
}

/****** SCROLL */




.group-panel__header { min-height: 76px; border-bottom: 1px solid rgba(var(--v-theme-on-surface), .09); background: linear-gradient(90deg, color-mix(in srgb, var(--group-color) 18%, transparent), transparent 58%); }
.group-panel__header button:hover { background: rgba(var(--v-theme-on-surface), .04) !important; }
.group-panel__count { flex-shrink: 0; color: rgb(var(--v-theme-on-surface)); background: rgba(var(--v-theme-on-surface), .09); }
.group-panel__delete { flex-shrink: 0; color: rgba(var(--v-theme-on-surface), .65); }.group-panel__delete:hover { color: rgb(var(--v-theme-error)); background: rgba(var(--v-theme-error), .12); }
.group-panel__empty { min-height: 160px; border: 1px dashed rgba(var(--v-theme-on-surface), .18); border-radius: 14px; background: rgba(var(--v-theme-on-surface), .025); }

/* ── Stop card add / remove / reflow animation ─────────────────────── */
.stop-card-enter-active { transition: opacity .3s ease, transform .3s ease; }
.stop-card-enter-from { opacity: 0; transform: translateY(14px) scale(.97); }

/*
 * A leaving card is taken out of the flow (position: absolute) so the
 * remaining cards can glide up smoothly via the move transition.
 */
.stop-card-leave-active {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 0;
  transition: opacity .25s ease, transform .25s ease;
}
.stop-card-leave-to { opacity: 0; transform: scale(.94); }

.stop-card-move { transition: transform .35s ease; }

/* ── Accessibility helpers ────────────────────────────────────────────── */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

/* One consistent focus ring for all interactive controls. */
main :is(a, button, input, select):focus-visible {
  outline: 2px solid rgba(var(--v-theme-primary), .4);
  outline-offset: 4px;
  border-radius: 4px; /* optional safety net, usually not needed */

}

/* ── Reduced motion ───────────────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  main *, main *::before, main *::after { transition-duration: .01ms !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; }

  .stop-card-enter-active,
  .stop-card-leave-active,
  .stop-card-move { transition: none !important; }
}

/* ── Forced colours (Windows High Contrast) ──────────────────────────── */
@media (forced-colors: active) {
  .group-panel { border: 1px solid CanvasText; }
}
</style>