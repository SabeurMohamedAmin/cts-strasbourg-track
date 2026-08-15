import type { Ref } from 'vue'
import type { ScheduleDirection, ScheduleLine, StopScheduleResponse } from '~~/shared/types/schedule'

/**
 * Line and direction the reader is looking at, at one station.
 *
 * Both selections repair themselves: changing station picks the first line
 * served there, and changing line starts again from its first direction.
 */
export function useStationLines(schedule: Ref<StopScheduleResponse | null>) {
  /** Lines calling at this station. */
  const lines = computed<ScheduleLine[]>(() => schedule.value?.lines ?? [])

  /** GTFS route_id of the selected line. */
  const selectedRouteId = ref('')
  /** Index inside `currentLine.directions`, not a GTFS direction_id. */
  const selectedDirection = ref(0)

  // The selected line is gone (another station): fall back to the first one.
  watch(lines, (list) => {
    if (!list.some(line => line.routeId === selectedRouteId.value))
      selectedRouteId.value = list[0]?.routeId ?? ''
  }, { immediate: true })

  // Another line means another pair of directions: start from the first.
  watch(selectedRouteId, () => {
    selectedDirection.value = 0
  })

  const currentLine = computed<ScheduleLine | null>(
    () => lines.value.find(line => line.routeId === selectedRouteId.value) ?? null,
  )

  const currentDirection = computed<ScheduleDirection | null>(
    () => currentLine.value?.directions[selectedDirection.value] ?? null,
  )

  /** Headsigns of the selected line, in the order of the direction toggle. */
  const directionLabels = computed(
    () => currentLine.value?.directions.map(direction => direction.headsign) ?? [],
  )

  return {
    lines,
    selectedRouteId,
    selectedDirection,
    currentLine,
    currentDirection,
    directionLabels,
  }
}
