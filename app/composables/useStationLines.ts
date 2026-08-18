import type { Ref } from 'vue'
import type { LocationQuery } from 'vue-router'
import type { ScheduleDirection, ScheduleLine, StopScheduleResponse } from '~~/shared/types/schedule'

/** Query parameter carrying the selected line from one station to the next. */
export const LINE_QUERY_KEY = 'line'

/** One comparable shape for labels, route ids and URLs: 'C 3' -> 'c3'. */
export function toLineSlug(value?: string): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Reads `?line=c3` from a route query; '' when the URL says nothing. */
export function readLineSlug(query: LocationQuery): string {
  const raw = query[LINE_QUERY_KEY]
  return toLineSlug(Array.isArray(raw) ? raw[0] ?? '' : raw ?? '')
}

/** Query to append to a station link, or `undefined` when no line is selected. */
export function lineQuery(lineLabel?: string) {
  const slug = toLineSlug(lineLabel)
  return slug ? { [LINE_QUERY_KEY]: slug } : undefined
}

/**
 * Line and direction the reader is looking at, at one station.
 *
 * The selected line lives in the URL (`/station/cite-de-l-ill?line=c3`), so it
 * survives a reload, a shared link and every hop along the route bar. Only a
 * line this station serves can win: when it does not serve `?line=c3` we keep
 * the line already on screen, and fall back to the first one served here.
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

  /** The line the URL asks for, when this station serves it. */
  function lineFromUrl(list: ScheduleLine[]): ScheduleLine | undefined {
    const wanted = readLineSlug(route.query)
    if (!wanted) return undefined

    return list.find(line =>
      toLineSlug(line.lineLabel) === wanted || toLineSlug(line.routeId) === wanted,
    )
  }

  // Runs on load, on every station change and on every `?line` change.
  watch([lines, () => route.query[LINE_QUERY_KEY]], () => {
    const list = lines.value
    const isStillServed = list.some(line => line.routeId === selectedRouteId.value)

    selectedRouteId.value = lineFromUrl(list)?.routeId
      ?? (isStillServed ? selectedRouteId.value : list[0]?.routeId ?? '')
  }, { immediate: true })

  // Another line means another pair of directions: start from the first.
  watch(selectedRouteId, () => {
    selectedDirection.value = 0
  })

  const currentLine = computed<ScheduleLine | null>(
    () => lines.value.find(line => line.routeId === selectedRouteId.value) ?? null,
  )

  // Write the selection back, so the address bar always shows what is on
  // screen. `replace` keeps the back button on the previous station.
  watch(currentLine, (line) => {
    if (!import.meta.client || !line) return
    if (readLineSlug(route.query) === toLineSlug(line.lineLabel)) return

    void router.replace({ query: { ...route.query, ...lineQuery(line.lineLabel) } })
  })

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
