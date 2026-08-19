/**
 * useStopArrivals — fetches and auto-refreshes upcoming arrivals for a stop.
 *
 * Usage:
 *   const { arrivals, pending, refresh } = useStopArrivals(stopId)
 *   const { arrivals } = useStopArrivals(stopId, { limit: 30, window: 240 })
 *
 * The composable:
 *   - Fetches in the BROWSER only, as soon as stopId is non-null.
 *   - Re-fetches every 30 seconds while a stop is selected.
 *   - Cleans up the interval on component unmount.
 *
 * Why browser-only (`server: false`):
 * arrivals are real-time and go stale within seconds, so server-rendering them
 * brings nothing. It also used to break hydration: the fetch was started from a
 * watcher, i.e. after the HTML was rendered but before the payload was
 * serialized, so the server sent "no live data" markup together with a payload
 * full of live arrivals, and the first client render disagreed with the DOM.
 */
import type { StopArrivalsResponse } from '~~/shared/types/stop'
import { apiV1 } from '~/utils/api'

export interface StopArrivalsOptions {
  /** Max results returned by the API (server caps at 30, default 10). */
  limit?: number
  /** Look-ahead window in minutes (server caps at 240, default 90). */
  window?: number
}

export function useStopArrivals(stopId: MaybeRef<string | null>, options: StopArrivalsOptions = {}) {
  const id = toRef(stopId)

  const { data, pending, error, refresh } = useFetch<StopArrivalsResponse>(
    () => apiV1(`/stops/${id.value}/arrivals`),
    {
      immediate: false,
      watch: false,
      server: false,
      query: { limit: options.limit ?? 10, window: options.window ?? 90 },
    },
  )

  if (import.meta.client) {
    // Trigger a fresh fetch whenever the selected stop changes.
    watch(id, async (newId) => {
      if (newId) await refresh()
    }, { immediate: true })

    // Keep a 30-second polling interval while a stop is active.
    let timer: ReturnType<typeof setInterval> | null = null
    watch(id, (newId) => {
      if (timer) clearInterval(timer)
      if (newId) timer = setInterval(refresh, 30_000)
    }, { immediate: true })
    onUnmounted(() => { if (timer) clearInterval(timer) })
  }

  return {
    arrivals: computed(() => data.value?.arrivals ?? []),
    stopName: computed(() => data.value?.stopName ?? ''),
    pending,
    error,
    refresh,
  }
}
