/**
 * useFavoriteGroupsStore
 *
 * Manages favourite stops organised in named, coloured groups.
 *
 * Data shape (persisted to localStorage as "cts-fav-groups"):
 *
 *   FavGroup[]
 *     id        – nanoid-style uuid
 *     name      – user-editable label
 *     color     – tailwind-ish key ('teal'|'blue'|'orange'|'pink'|'green')
 *     collapsed – whether the section is collapsed in the panel
 *     stopIds   – ordered list of stop IDs in this group
 *
 * Rules:
 *   - The first group (id === DEFAULT_GROUP_ID) is the default and cannot
 *     be deleted or moved.
 *   - A stop can appear in multiple groups (like browser bookmark folders).
 *   - Stops that were in the old flat favourites list are migrated to the
 *     default group on first hydration.
 *   - Groups are collapsed by default; pages call collapseAll() on mount
 *     so every visit starts with closed panels.
 */
import { defineStore } from 'pinia'
import { useStopsStore } from '~/stores/stops'

export const DEFAULT_GROUP_ID = 'default'

export interface FavGroup {
  id: string
  name: string
  color: GroupColor
  collapsed: boolean
  stopIds: string[]
}

export type GroupColor = 'teal' | 'blue' | 'orange' | 'pink' | 'green' | 'purple' | 'grey'

export const GROUP_COLORS: { key: GroupColor; hex: string; label: string }[] = [
  { key: 'teal',   hex: '#00897b', label: 'Sarcelle'  },
  { key: 'blue',   hex: '#1e88e5', label: 'Bleu'      },
  { key: 'orange', hex: '#fb8c00', label: 'Orange'    },
  { key: 'pink',   hex: '#e91e8c', label: 'Rose'      },
  { key: 'green',  hex: '#43a047', label: 'Vert'      },
  { key: 'purple', hex: '#7b1fa2', label: 'Violet'    },
  { key: 'grey',   hex: '#757575', label: 'Gris'      },
]

const STORAGE_KEY = 'cts-fav-groups'
const LEGACY_KEY  = 'cts-favorite-stops'

/** Generate a short unique id without a dependency */
function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function defaultGroup(): FavGroup {
  return { id: DEFAULT_GROUP_ID, name: 'Mes favoris', color: 'teal', collapsed: true, stopIds: [] }
}

export const useFavoriteGroupsStore = defineStore('favoriteGroups', () => {
  const groups = ref<FavGroup[]>([defaultGroup()])
  let hydrated = false

  // ── Persistence ────────────────────────────────────────────────────────
  function persist() {
    if (!import.meta.client) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups.value))
  }

  /**
   * Hydrate from localStorage.
   * Migrates the old flat array (LEGACY_KEY) into the default group once.
   */
  function hydrate() {
    if (hydrated || !import.meta.client) return
    hydrated = true

    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as FavGroup[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Ensure default group always exists as first item
          const hasDefault = parsed.some(g => g.id === DEFAULT_GROUP_ID)
          groups.value = hasDefault ? parsed : [defaultGroup(), ...parsed]
          return
        }
      }
      catch { /* ignore corrupted data */ }
    }

    // ── Migrate legacy flat list ─────────────────────────────────────────
    const legacyRaw = localStorage.getItem(LEGACY_KEY)
    if (legacyRaw) {
      try {
        const legacyIds = JSON.parse(legacyRaw) as string[]
        if (Array.isArray(legacyIds)) {
          groups.value[0]!.stopIds = legacyIds.filter(id => typeof id === 'string')
          persist()
          localStorage.removeItem(LEGACY_KEY)
        }
      }
      catch { /* ignore */ }
    }
  }

  // ── Computed ─────────────────────────────────────────────────────────────
  /** All unique stop IDs across all groups (for backwards-compat checks). */
  const allFavoriteIds = computed(() => {
    const ids = new Set<string>()
    for (const g of groups.value) g.stopIds.forEach(id => ids.add(id))
    return ids
  })

  function isFavorite(stopId: string): boolean {
    return allFavoriteIds.value.has(stopId)
  }

  // ── Group actions ─────────────────────────────────────────────────────
  function createGroup(name: string, color: GroupColor = 'blue'): FavGroup {
    const group: FavGroup = { id: uid(), name: name.trim() || 'Nouveau groupe', color, collapsed: true, stopIds: [] }
    groups.value.push(group)
    persist()
    return group
  }

  function renameGroup(groupId: string, newName: string) {
    const g = groups.value.find(g => g.id === groupId)
    if (g) { g.name = newName.trim() || g.name; persist() }
  }

  function setGroupColor(groupId: string, color: GroupColor) {
    const g = groups.value.find(g => g.id === groupId)
    if (g) { g.color = color; persist() }
  }

  function deleteGroup(groupId: string) {
    if (groupId === DEFAULT_GROUP_ID) return // default group is permanent
    groups.value = groups.value.filter(g => g.id !== groupId)
    persist()
  }

  function toggleCollapse(groupId: string) {
    const g = groups.value.find(g => g.id === groupId)
    if (g) { g.collapsed = !g.collapsed; persist() }
  }

  /** Collapse every group. Called on page mount so panels start closed. */
  function collapseAll() {
    groups.value.forEach((g) => { g.collapsed = true })
    persist()
  }

  // ── Stop actions ──────────────────────────────────────────────────────
  /** Add a stop to a group (default group if groupId omitted). */
  function addStop(stopId: string, groupId: string = DEFAULT_GROUP_ID) {
    const g = groups.value.find(g => g.id === groupId)
    if (g && !g.stopIds.includes(stopId)) { g.stopIds.push(stopId); persist() }
  }

  /** Remove a stop from a specific group. */
  function removeStop(stopId: string, groupId: string) {
    const g = groups.value.find(g => g.id === groupId)
    if (g) { g.stopIds = g.stopIds.filter(id => id !== stopId); persist() }
  }

  /** Remove a stop from ALL groups (full un-favourite). */
  function removeStopFromAll(stopId: string) {
    groups.value.forEach(g => { g.stopIds = g.stopIds.filter(id => id !== stopId) })
    persist()
  }

  /** Move a stop from one group to another. */
  function moveStop(stopId: string, fromGroupId: string, toGroupId: string) {
    removeStop(stopId, fromGroupId)
    addStop(stopId, toGroupId)
  }

  return {
    groups,
    allFavoriteIds,
    hydrate,
    persist,
    isFavorite,
    createGroup,
    renameGroup,
    setGroupColor,
    deleteGroup,
    toggleCollapse,
    collapseAll,
    addStop,
    removeStop,
    removeStopFromAll,
    moveStop,
  }
})
