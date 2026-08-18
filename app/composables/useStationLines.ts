import type { Ref } from 'vue'
import type { LocationQuery } from 'vue-router'
import type { ScheduleDirection, ScheduleLine, StopScheduleResponse } from '~~/shared/types/schedule'

/** Query parameter carrying the selected line from one station to the next. */
export const LINE_QUERY_KEY = 'line'
/** Query parameter carrying the selected direction from one station to the next. */
export const DIRECTION_QUERY_KEY = 'direction'

/** One comparable shape for labels, route ids and URLs: 'C 3' -> 'c3'. */
export function toLineSlug(value?: string): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** One comparable shape for headsigns, direction ids and URLs: 'Lingolsheim Alouettes' -> 'lingolsheim-alouettes'. */
export function toDirectionSlug(value?: string): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Reads `?line=c3` from a route query; '' when the URL says nothing. */
export function readLineSlug(query: LocationQuery): string {
  const raw = query[LINE_QUERY_KEY]
  return toLineSlug(Array.isArray(raw) ? raw[0] ?? '' : raw ?? '')
}

/** Reads `?direction=lingolsheim-alouettes` from a route query; '' when the URL says nothing. */
export function readDirectionSlug(query: LocationQuery): string {
  const raw = query[DIRECTION_QUERY_KEY]
  return toDirectionSlug(Array.isArray(raw) ? raw[0] ?? '' : raw ?? '')
}

/** Query to append to a station link for line, or `undefined` when no line is selected. */
export function lineQuery(lineLabel?: string) {
  const slug = toLineSlug(lineLabel)
  return slug ? { [LINE_QUERY_KEY]: slug } : undefined
}

/** Query to append to a station link for direction, or `undefined` when no direction is selected. */
export function directionQuery(directionHeadsign?: string) {
  const slug = toDirectionSlug(directionHeadsign)
  return slug ? { [DIRECTION_QUERY_KEY]: slug } : undefined
}

/** Combined query to append to a station link carrying both line and direction. */
export function stationQuery(lineLabel?: string, directionHeadsign?: string) {
  return {
    ...lineQuery(lineLabel),
    ...directionQuery(directionHeadsign),
  }
}

/**
 * Line and direction the reader is looking at, at one station.
 *
 * The selected line and direction live in the URL (`/station/cite-de-l-ill?line=c3&direction=lingolsheim-alouettes`),
 * so they survive a reload, a shared link and every hop along the route bar. Only a
 * line/direction this station serves can win; fallback to the defaults served here.
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

  /** The direction index the URL asks for, when the line has it. */
  function directionFromUrl(line: ScheduleLine | null): number | undefined {
    if (!line) return undefined
    const wanted = readDirectionSlug(route.query)
    if (!wanted) return undefined
    const wantedCompact = wanted.replace(/-/g, '')

    const index = line.directions.findIndex((dir, i) => {
      const dirSlug = toDirectionSlug(dir.headsign)
      return dirSlug === wanted
        || dirSlug.replace(/-/g, '') === wantedCompact
        || String(i) === wanted
        || String(dir.directionId) === wanted
        || dir.headsigns.some((h) => {
          const hSlug = toDirectionSlug(h)
          return hSlug === wanted || hSlug.replace(/-/g, '') === wantedCompact
        })
    })

    return index >= 0 ? index : undefined
  }

  // Runs on load, on every station change and on every `?line` change.
  watch([lines, () => route.query[LINE_QUERY_KEY]], () => {
    const list = lines.value
    const isStillServed = list.some(line => line.routeId === selectedRouteId.value)

    selectedRouteId.value = lineFromUrl(list)?.routeId
      ?? (isStillServed ? selectedRouteId.value : list[0]?.routeId ?? '')
  }, { immediate: true })

  const currentLine = computed<ScheduleLine | null>(
    () => lines.value.find(line => line.routeId === selectedRouteId.value) ?? null,
  )

  // Sync direction when currentLine or `?direction` query changes
  watch([currentLine, () => route.query[DIRECTION_QUERY_KEY]], () => {
    const line = currentLine.value
    if (!line || !line.directions.length) {
      selectedDirection.value = 0
      return
    }

    const urlDirIndex = directionFromUrl(line)
    if (urlDirIndex !== undefined) {
      selectedDirection.value = urlDirIndex
    } else if (selectedDirection.value >= line.directions.length) {
      selectedDirection.value = 0
    }
  }, { immediate: true })

  const currentDirection = computed<ScheduleDirection | null>(
    () => currentLine.value?.directions[selectedDirection.value] ?? null,
  )

  // Write the selection back, so the address bar always shows what is on
  // screen. `replace` keeps the back button on the previous station.
  watch([currentLine, currentDirection], ([line, direction]) => {
    if (!import.meta.client || !line) return

    const lineMatch = readLineSlug(route.query) === toLineSlug(line.lineLabel)
    const dirMatch = readDirectionSlug(route.query) === toDirectionSlug(direction?.headsign)

    if (lineMatch && dirMatch) return

    void router.replace({
      query: {
        ...route.query,
        ...stationQuery(line.lineLabel, direction?.headsign),
      },
    })
  })

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

