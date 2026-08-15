import type { ComputedRef } from 'vue'
import type { StopScheduleResponse } from '~~/shared/types/schedule'

/** Cache key of one station, shared with plugins/prefetch-station.client.ts. */
export function stationScheduleKey(slug: string): string {
  return `station-schedule-${slug}`
}

/** Timetable endpoint of one station. */
export function stationScheduleUrl(slug: string): string {
  return `/api/stations/${encodeURIComponent(slug)}/schedule`
}

/**
 * Theoretical timetable of one station.
 *
 * A timetable does not change during the day, so each station gets its own cache
 * key: Nuxt then serves a station we already loaded, or that NuxtLink prefetched
 * from the route bar, without a new request and without a loading state.
 */
export async function useStationSchedule(slug: ComputedRef<string>) {
  const { data, error, status } = await useFetch<StopScheduleResponse>(
    () => stationScheduleUrl(slug.value),
    {
      lazy: true,
      key: () => stationScheduleKey(slug.value),
      getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] as StopScheduleResponse | undefined,
    },
  )

  /**
   * Station currently displayed: the last one that loaded successfully.
   *
   * `useFetch` resets its `data` to null while a station that is not cached
   * downloads, and rendering that empty state made the page collapse to the
   * loading spinner for a few frames (white flash, jumping scroll). Keeping the
   * last station here means the page only ever swaps content in place.
   */
  const schedule = ref<StopScheduleResponse | null>(null)
  watch(data, (value) => {
    if (value) schedule.value = value
  }, { immediate: true })

  return {
    schedule,
    error,
    /** Another station is downloading while this one is still readable. */
    isSwitching: computed(() => status.value === 'pending'),
  }
}
