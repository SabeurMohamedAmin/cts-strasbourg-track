/**
 * stops store
 *
 * Responsibilities:
 *   - Full stop list + search filtering
 *   - Selected stop (id → full object)
 *   - Distance from user to selected stop (set by useNearestStops)
 *   - Favourite stops: persist to localStorage, expose a clean API
 *
 * Favourite API surface (intentionally minimal):
 *   isFavorite(stopId)  — reactive boolean check (O(1) Set lookup)
 *   toggleFavorite(stopId) — single action; add or remove
 *   clearFavorites()    — wipe all favourites
 *   hydrateFavorites()  — call once on app mount to restore from localStorage
 */
import { defineStore } from 'pinia'
import { apiV1 } from '~/utils/api'
import { searchStops } from '~/utils/stopSearch'

export interface Stop {
  stopId: string
  stopName: string
  stopLat: number
  stopLon: number
  locationType: number
  parentStation: string | null
  routes: string[]
  modes: Array<'tram' | 'bus'>
}

export const useStopsStore = defineStore('stops', () => {
  // ── State ────────────────────────────────────────────────────────────────
  const stops = ref<Stop[]>([])
  const selectedStopId = ref<string | null>(null)
  const searchQuery = ref('')
  let stopsRequest: Promise<Stop[]> | null = null

  /**
   * Persisted as a Set for O(1) lookups.  Never mutate directly — always go
   * through toggleFavorite / clearFavorites so persistence stays in sync.
   */
  const favoriteStopIds = ref<Set<string>>(new Set())

  /**
   * Distance (metres) from the user to the currently selected stop.
   * Populated externally by useNearestStops after a geolocation result.
   */
  const selectedStopDistance = ref<number | null>(null)

  /**
   * Guards against calling hydrateFavorites() more than once.
   * Stored as a ref so it survives HMR store recreation.
   */
  const favoritesHydrated = ref(false)

  // ── Data fetching ────────────────────────────────────────────────────────
  async function fetchStops() {
    if (stops.value.length) return stops.value
    if (!stopsRequest) {
      stopsRequest = $fetch<Stop[]>(apiV1('/stops'))
        .then((data) => {
          stops.value = data
          return data
        })
        .finally(() => { stopsRequest = null })
    }
    return stopsRequest
  }

  /** Indexed lookup avoids scanning the full GTFS stop list for every favorite. */
  const stopsById = computed(() => new Map(stops.value.map(stop => [stop.stopId, stop])))

  // ── Computed ─────────────────────────────────────────────────────────────
  /**
   * Stops matching the current search query.
   *
   * Delegates to searchStops (app/utils/stopSearch.ts) which is
   * accent/case-insensitive and returns results ranked best-first
   * (exact > prefix > word start > substring).
   * An empty query keeps the historical behaviour: the full list.
   */
  const filteredStops = computed(() => {
    if (!searchQuery.value.trim()) return stops.value
    return searchStops(stops.value, searchQuery.value)
  })

  /**
   * Full Stop objects for every favourited stop.
   * If stops haven't loaded yet the list is empty — callers that need this
   * before fetchStops() should use favoriteStopIds directly.
   */
  const favoriteStops = computed(() =>
    stops.value.filter(s => favoriteStopIds.value.has(s.stopId)),
  )

  /** The full Stop object for the currently selected id, or null. */
  const selectedStop = computed(() =>
    stops.value.find(s => s.stopId === selectedStopId.value) ?? null,
  )

  // ── Favourite persistence ────────────────────────────────────────────────
  const LS_KEY = 'cts-favorite-stops'

  /** Restore favourite IDs from localStorage.  Safe to call multiple times. */
  function hydrateFavorites() {
    if (favoritesHydrated.value || !import.meta.client) return
    favoritesHydrated.value = true
    try {
      const raw = localStorage.getItem(LS_KEY)
      const parsed = JSON.parse(raw ?? '[]')
      if (Array.isArray(parsed)) {
        favoriteStopIds.value = new Set(
          parsed.filter((id: unknown): id is string => typeof id === 'string'),
        )
      }
    }
    catch {
      // Corrupted data — reset silently.
      localStorage.removeItem(LS_KEY)
    }
  }

  /** Write the current set of IDs to localStorage. */
  function _persistFavorites() {
    if (!import.meta.client) return
    localStorage.setItem(LS_KEY, JSON.stringify([...favoriteStopIds.value]))
  }

  // ── Favourite actions ────────────────────────────────────────────────────
  /**
   * Check whether a stop is favourited.  Uses a Set so lookup is O(1).
   * Reactive: any template that calls this re-renders when favoriteStopIds changes.
   */
  function isFavorite(stopId: string): boolean {
    return favoriteStopIds.value.has(stopId)
  }

  /**
   * Add if absent, remove if present.  Single entry-point for all toggle UI.
   */
  function toggleFavorite(stopId: string) {
    if (favoriteStopIds.value.has(stopId)) {
      favoriteStopIds.value.delete(stopId)
    }
    else {
      favoriteStopIds.value.add(stopId)
    }
    _persistFavorites()
  }

  /** Wipe all favourites (e.g. from a settings / management screen). */
  function clearFavorites() {
    favoriteStopIds.value = new Set()
    _persistFavorites()
  }

  // ── Selection ────────────────────────────────────────────────────────────
  function selectStop(id: string) {
    selectedStopId.value = id
  }

  function clearSelectedStop() {
    selectedStopId.value = null
    selectedStopDistance.value = null
  }

  return {
    // State
    stops,
    stopsById,
    selectedStopId,
    selectedStop,
    selectedStopDistance,
    searchQuery,
    favoriteStopIds,
    // Computed
    filteredStops,
    favoriteStops,
    // Data
    fetchStops,
    // Favourites
    hydrateFavorites,
    isFavorite,
    toggleFavorite,
    clearFavorites,
    // Selection
    selectStop,
    clearSelectedStop,
    /** @deprecated Use clearSelectedStop() */ clearSelection: clearSelectedStop,
  }
})
