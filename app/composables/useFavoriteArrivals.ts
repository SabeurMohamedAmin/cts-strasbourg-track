import type { StopArrivalsResponse } from '~~/shared/types/stop'

const CACHE_TTL_MS = 20_000

interface CachedArrival {
  expiresAt: number
  value: StopArrivalsResponse | null
}

const cache = new Map<string, CachedArrival>()
const pendingRequests = new Map<string, Promise<Record<string, StopArrivalsResponse | null>>>()

/** Loads all favorite arrivals in one browser request and reuses fresh results across pages. */
export function useFavoriteArrivals() {
  async function fetchFavoriteArrivals(stopIds: string[], limit = 8, window = 90, force = false) {
    const ids = [...new Set(stopIds)]
    const now = Date.now()
    const result: Record<string, StopArrivalsResponse | null> = {}
    const missingIds: string[] = []

    for (const id of ids) {
      const cacheKey = `${id}:${limit}:${window}`
      if (force) cache.delete(cacheKey)
      const cached = cache.get(cacheKey)
      if (!force && cached && cached.expiresAt > now) result[id] = cached.value
      else missingIds.push(id)
    }

    if (!missingIds.length) return result

    const queryParams: Record<string, any> = { ids: missingIds.join(','), limit, window }
    if (force) {
      queryParams.refresh = '1'
      // Cache-buster: the endpoint responds with max-age=15, so without a
      // unique URL the browser could answer a repeated forced refresh from
      // its own HTTP cache without ever contacting the server.
      queryParams._t = Date.now()
    }

    const requestKey = `${missingIds.slice().sort().join(',')}:${limit}:${window}:${force ? Date.now() : ''}`
    let request = pendingRequests.get(requestKey)
    if (!request) {
      request = $fetch<Record<string, StopArrivalsResponse | null>>('/api/stops/arrivals', {
        query: queryParams,
      }).finally(() => pendingRequests.delete(requestKey))
      pendingRequests.set(requestKey, request)
    }

    const responses = await request
    for (const id of missingIds) {
      const value = responses[id] ?? null
      result[id] = value
      cache.set(`${id}:${limit}:${window}`, { expiresAt: Date.now() + CACHE_TTL_MS, value })
    }

    return result
  }

  return { fetchFavoriteArrivals }
}
