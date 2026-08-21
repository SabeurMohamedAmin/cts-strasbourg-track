/**
 * stopSearch — pure helpers behind the stop search feature.
 *
 * Kept free of any Vue / Nuxt / Pinia imports on purpose:
 *   - trivially unit-testable (see tests/unit/stop-search.test.ts)
 *   - reusable by any consumer (stops store, future API endpoints…)
 *
 * Why not a simple `includes()`?
 *   1. Strasbourg stop names are full of accents (République, Élysée…).
 *      Users type without them, so matching must be accent-insensitive.
 *   2. Results need ranking: for the query "gare", the stop "Gare Centrale"
 *      must appear before "Petite Gare" which must appear before "Margarethen".
 */

/** Combining diacritical marks produced by NFD decomposition (é → e + ́). */
const DIACRITICS_REGEX = /[\u0300-\u036f]/g

/**
 * Normalize free text for comparison:
 *   - strip accents            "République"      → "republique"
 *   - lowercase (fr locale)    "FER"             → "fer"
 *   - apostrophes / hyphens
 *     become word separators   "l'Étoile-Bourse" → "l etoile bourse"
 *   - collapse whitespace      "Homme   de Fer"  → "homme de fer"
 */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(DIACRITICS_REGEX, '')
    .toLocaleLowerCase('fr')
    .replace(/['\u2019-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Score how well a stop name matches an ALREADY-NORMALIZED query.
 * Higher is better; -1 means "no match, exclude from results".
 */
export function scoreMatch(stopName: string, normalizedQuery: string): number {
  const name = normalizeSearchText(stopName)
  if (name === normalizedQuery) return 100
  if (name.startsWith(normalizedQuery)) return 80
  if (name.includes(` ${normalizedQuery}`)) return 65
  if (name.includes(normalizedQuery)) return 50

  // Users often omit connector words: "homme fer" must still match
  // "Homme de Fer". Every query token must match a word prefix, and earlier
  // words receive a small bonus so natural word order ranks first.
  const queryTokens = normalizedQuery.split(' ').filter(Boolean)
  const nameTokens = name.split(' ')
  if (queryTokens.length < 2) return -1

  let previousIndex = -1
  let score = 30
  for (const token of queryTokens) {
    const index = nameTokens.findIndex(word => word.startsWith(token))
    if (index === -1) return -1
    if (index > previousIndex) score += 3
    if (nameTokens[index] === token) score += 2
    previousIndex = index
  }
  return score
}

/**
 * Combine platforms that represent opposite directions of the same station.
 * GTFS links those platforms through `parentStation`; the normalized name is
 * a fallback for feeds where that relationship is absent.
 *
 * The first ranked platform remains selectable while its line and mode
 * metadata is merged with the other platforms.
 */
export function groupStopDirections<T extends {
  stopName: string
  parentStation?: string | null
  routes?: string[]
  modes?: string[]
}>(items: T[]): T[] {
  const groups = new Map<string, T>()

  for (const item of items) {
    const key = item.parentStation
      ? `station:${item.parentStation}`
      : `name:${normalizeSearchText(item.stopName)}`
    const existing = groups.get(key)

    if (!existing) {
      groups.set(key, {
        ...item,
        routes: item.routes ? [...item.routes] : item.routes,
        modes: item.modes ? [...item.modes] : item.modes,
      })
      continue
    }

    if (existing.routes || item.routes) {
      existing.routes = [...new Set([...(existing.routes ?? []), ...(item.routes ?? [])])]
    }
    if (existing.modes || item.modes) {
      existing.modes = [...new Set([...(existing.modes ?? []), ...(item.modes ?? [])])]
    }
  }

  return [...groups.values()]
}

/**
 * Search a list of stops by name.
 *
 * Generic over anything with a `stopName` so the store's full `Stop`
 * objects flow through untouched (results keep routes, modes, coords…).
 *
 * @returns matching items, best match first, alphabetical tiebreak,
 *          capped at `limit`. Empty query → empty list (callers decide
 *          what an empty search box means — the store shows all stops).
 */
export function searchStops<T extends {
  stopName: string
  parentStation?: string | null
  routes?: string[]
  modes?: string[]
}>(
  items: T[],
  query: string,
  limit = 20,
): T[] {
  const normalizedQuery = normalizeSearchText(query)
  if (normalizedQuery.length < 2) return []

  const rankedItems = items
    .map((item) => {
      const nameScore = scoreMatch(item.stopName, normalizedQuery)
      const exactRoute = item.routes?.some(route => normalizeSearchText(route) === normalizedQuery)
      // An exact line query is useful, but named station matches remain first.
      return { item, score: Math.max(nameScore, exactRoute ? 45 : -1) }
    })
    .filter(entry => entry.score >= 0)
    .sort((a, b) =>
      b.score - a.score
      || a.item.stopName.localeCompare(b.item.stopName, 'fr'),
    )
    .map(entry => entry.item)

  // Group before applying the limit so duplicate platforms do not consume
  // result slots that could show another station.
  return groupStopDirections(rankedItems).slice(0, limit)
}
