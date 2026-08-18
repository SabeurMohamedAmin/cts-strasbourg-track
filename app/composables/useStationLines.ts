import type { Ref } from 'vue'
import type { ScheduleDirection, ScheduleLine, StopScheduleResponse } from '~~/shared/types/schedule'

/**
 * Normalizes a line identifier (label or routeId) for case-insensitive comparison.
 * Handles spaces and dashes cleanly (e.g. "C3" -> "c3", "c3" -> "c3", "C 3" -> "c3").
 */
export function normalizeLineSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Extracts and decodes the line query parameter from route query object.
 * Checks 'line', 'ligne', 'selected-line', or 'slected-ligne' for full backward compatibility.
 */
export function getLineFromQuery(query: Record<string, any>): string {
  const raw = query.line ?? query.ligne ?? query['selected-line'] ?? query['slected-ligne']
  if (!raw) return ''
  const value = Array.isArray(raw) ? raw[0] : String(raw)
  try {
    return decodeURIComponent(value).trim()
  } catch {
    return value.trim()
  }
}

/**
 * Line and direction the reader is looking at, at one station.
 * Synchronizes the active line selection with the URL query parameter (`?line=...`)
 * so line context is preserved when navigating between stations.
 */
export function useStationLines(schedule: Ref<StopScheduleResponse | null>) {
  const route = useRoute()
  const router = useRouter()

  /** Lines calling at this station. */
  const lines = computed<ScheduleLine[]>(() => schedule.value?.lines ?? [])

  /** GTFS route_id of the selected line. */
  const selectedRouteId = ref('')
  /** Index inside `currentLine.directions`, not a GTFS direction_id. */
  const selectedDirection = ref(0)

  /**
   * Synchronizes `selectedRouteId` with the URL query parameter or available lines.
   */
  function syncSelectedLine() {
    const list = lines.value
    if (!list.length) {
      selectedRouteId.value = ''
      return
    }

    const requestedLine = getLineFromQuery(route.query)
    if (requestedLine) {
      const target = normalizeLineSlug(requestedLine)
      const matched = list.find(line =>
        normalizeLineSlug(line.lineLabel) === target
        || normalizeLineSlug(line.routeId) === target,
      )
      if (matched) {
        selectedRouteId.value = matched.routeId
        return
      }
    }

    // Keep current selection if it exists in the updated line list
    if (selectedRouteId.value && list.some(line => line.routeId === selectedRouteId.value)) {
      return
    }

    // Fallback: default to the first line served at this station
    selectedRouteId.value = list[0]?.routeId ?? ''
  }

  // Synchronize selection whenever lines or line query changes
  watch(
    [lines, () => route.query.line, () => route.query.ligne],
    () => {
      syncSelectedLine()
    },
    { immediate: true },
  )

  // Reset direction and update URL query parameter when selected line changes
  watch(selectedRouteId, (newRouteId) => {
    selectedDirection.value = 0

    const matchedLine = lines.value.find(line => line.routeId === newRouteId)
    if (matchedLine && import.meta.client) {
      const currentQueryLine = getLineFromQuery(route.query)
      if (normalizeLineSlug(currentQueryLine) !== normalizeLineSlug(matchedLine.lineLabel)) {
        router.replace({
          query: {
            ...route.query,
            line: matchedLine.lineLabel,
          },
        }).catch(() => {})
      }
    }
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

