import type { ComputedRef } from 'vue'
import type { ScheduleDirection, ScheduleLine } from '~~/shared/types/schedule'
import type { StopArrival } from '~~/shared/types/stop'
import { secondsSinceMidnightInParis } from '~/utils/time'

/** How many departures the station page shows for a direction. */
const MAX_DEPARTURES = 2

/** Accents and case must not break the match with the CTS headsigns. */
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim()
}

/**
 * The next departures of one line + direction at a station.
 *
 * Live arrivals win when the CTS feed knows this direction; otherwise the
 * theoretical timetable fills in, so the reader never faces an empty block.
 */
export function useNextDepartures(options: {
  line: ComputedRef<ScheduleLine | null>
  direction: ComputedRef<ScheduleDirection | null>
  arrivals: ComputedRef<StopArrival[]>
  now: ComputedRef<Date>
}) {
  const { line, direction, arrivals, now } = options

  /** Real-time arrivals of this line heading this way. */
  const live = computed<StopArrival[]>(() => {
    if (!line.value || !direction.value) return []

    const headsigns = new Set(direction.value.headsigns.map(normalize))

    return arrivals.value
      .filter(arrival => arrival.mode === line.value!.mode
        && arrival.lineLabel === line.value!.lineLabel
        && headsigns.has(normalize(arrival.destination)))
      .slice(0, MAX_DEPARTURES)
  })

  /** Next times written in the timetable, turned into arrival-shaped items. */
  const theoretical = computed<StopArrival[]>(() => {
    const currentLine = line.value
    const currentDirection = direction.value
    if (!currentLine || !currentDirection) return []

    const nowSeconds = secondsSinceMidnightInParis(now.value)
    const departures: StopArrival[] = []

    for (const row of currentDirection.hours) {
      for (const minute of row.minutes) {
        const departureSeconds = row.hour * 3600 + minute * 60
        if (departureSeconds < nowSeconds) continue

        departures.push({
          tripId: `theoretical-${currentLine.routeId}-${currentDirection.directionId}-${row.hour}-${minute}`,
          lineLabel: currentLine.lineLabel,
          destination: currentDirection.headsign,
          scheduledArrival: new Date(now.value.getTime() + (departureSeconds - nowSeconds) * 1_000).toISOString(),
          mode: currentLine.mode,
          routeColor: currentLine.routeColor,
          routeTextColor: currentLine.routeTextColor,
          status: 'scheduled',
        })

        if (departures.length === MAX_DEPARTURES) return departures
      }
    }

    return departures
  })

  return {
    departures: computed(() => live.value.length ? live.value : theoretical.value),
  }
}
