import type { StopArrivalsResponse } from '~~/shared/types/stop'

const MAX_STOP_IDS = 50
const CACHE_TTL_MS = 20_000

interface CacheEntry {
  expiresAt: number
  value: StopArrivalsResponse
}

const responseCache = new Map<string, CacheEntry>()
const pendingRequests = new Map<string, Promise<StopArrivalsResponse>>()

function parseInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), min), max)
}

export default defineEventHandler(async (event): Promise<Record<string, StopArrivalsResponse | null>> => {
  const query = getQuery(event)
  const ids = [...new Set(String(query.ids ?? '').split(',').map(id => id.trim()).filter(Boolean))]

  if (!ids.length) throw createError({ statusCode: 400, message: 'Paramètre ids requis' })
  if (ids.length > MAX_STOP_IDS) throw createError({ statusCode: 400, message: `Maximum ${MAX_STOP_IDS} arrêts` })

  const forceRefresh = Boolean(query.refresh || query._t)
  const limit = parseInteger(query.limit, 4, 1, 30)
  const window = parseInteger(query.window, 90, 1, 240)
  const now = Date.now()

  const entries = await Promise.all(ids.map(async (stopId) => {
    const cacheKey = `${stopId}:${limit}:${window}`
    if (forceRefresh) responseCache.delete(cacheKey)
    const cached = responseCache.get(cacheKey)
    if (!forceRefresh && cached && cached.expiresAt > now) return [stopId, cached.value] as const

    // The force flag is part of the key: a forced request must not join a
    // non-forced in-flight one, which would skip the SIRI cache bypass.
    const pendingKey = `${cacheKey}:${forceRefresh ? 'fresh' : 'cached'}`
    let pending = pendingRequests.get(pendingKey)
    if (!pending) {
      const fetchQuery: Record<string, any> = { limit, window }
      if (forceRefresh) fetchQuery.refresh = '1'
      pending = event.$fetch<StopArrivalsResponse>(`/api/stops/${encodeURIComponent(stopId)}/arrivals`, {
        query: fetchQuery,
      })
      pendingRequests.set(pendingKey, pending)
    }

    try {
      const value = await pending
      responseCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value })
      return [stopId, value] as const
    }
    catch {
      return [stopId, null] as const
    }
    finally {
      pendingRequests.delete(pendingKey)
    }
  }))

  if (responseCache.size > 500) {
    for (const [key, entry] of responseCache) {
      if (entry.expiresAt <= now) responseCache.delete(key)
    }
  }

  // Forced refreshes must never be answered by the browser's HTTP cache.
  setResponseHeader(
    event,
    'Cache-Control',
    forceRefresh ? 'no-store' : 'private, max-age=15, stale-while-revalidate=30',
  )
  return Object.fromEntries(entries)
})
