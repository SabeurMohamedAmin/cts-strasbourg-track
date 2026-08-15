import type { ComputedRef } from 'vue'
import type { StopScheduleResponse } from '~~/shared/types/schedule'

/**
 * Theoretical timetable of one station, from GET /api/stations/:slug/schedule.
 *
 * The station stays on screen while the next one downloads. `useFetch` resets
 * its `data` to null as soon as the URL changes, and rendering that empty state
 * made the page collapse to the loading spinner for a few frames: a white flash
 * and a jumping scroll position every time the reader walked to the next stop.
 */
export async function useStationSchedule(slug: ComputedRef<string>) {
  const { data, error, status } = await useFetch<StopScheduleResponse>(
    () => `/api/stations/${encodeURIComponent(slug.value)}/schedule`,
    { lazy: true },
  )

  /** Station currently displayed: the last one that loaded successfully. */
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
