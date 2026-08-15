/**
 * useStopArrivals — fetches and auto-refreshes upcoming arrivals for a stop.
 *
 * Usage:
 *   const { arrivals, pending, refresh } = useStopArrivals(stopId)
 *   const { arrivals } = useStopArrivals(stopId, { limit: 30, window: 240 })
 *
 * The composable:
 *   - Fetches immediately when stopId becomes non-null.
 *   - Re-fetches every 30 seconds while a stop is selected.
 *   - Cleans up the interval on component unmount.
 */
import type { StopArrivalsResponse } from '~~/shared/types/stop'

export interface StopArrivalsOptions {
  /** Max results returned by the API (server caps at 30, default 10). */
  limit?: number
  /** Look-ahead window in minutes (server caps at 240, default 90). */
  window?: number
}

export function useStopArrivals(stopId: MaybeRef<string | null>, options: StopArrivalsOptions = {}) {
  const id = toRef(stopId)

  const { data, pending, error, refresh } = useFetch<StopArrivalsResponse>(
    () => `/api/stops/${id.value}/arrivals`,
    {
      immediate: false,
      watch: false,
      query: { limit: options.limit ?? 10, window: options.window ?? 90 },
    },
  )

  // Trigger a fresh fetch whenever the selected stop changes.
  watch(id, async (newId) => {
    if (newId) await refresh()
  }, { immediate: true })

  // Keep a 30-second polling interval while a stop is active.
  let timer: ReturnType<typeof setInterval> | null = null
  watch(id, (newId) => {
    if (timer) clearInterval(timer)
    if (newId) timer = setInterval(refresh, 30_000)
  })
  onUnmounted(() => { if (timer) clearInterval(timer) })

  return {
    arrivals: computed(() => data.value?.arrivals ?? []),
    stopName: computed(() => data.value?.stopName ?? ''),
    pending,
    error,
    refresh,
  }
}
