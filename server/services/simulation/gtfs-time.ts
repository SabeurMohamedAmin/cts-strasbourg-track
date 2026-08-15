/**
 * GTFS time helpers.
 *
 * GTFS uses `HH:MM:SS` strings that may exceed 24:00:00 for trips running
 * past midnight (e.g. "25:10:00" = 01:10 the next day). All computations in
 * the simulator use "seconds since midnight of the service day".
 *
 * The CTS network lives in Europe/Paris, while the server may run in UTC,
 * so "now" is always resolved through the Europe/Paris time zone.
 */

export type WeekdayKey =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

const PARIS_TZ = 'Europe/Paris'

/** Parse a GTFS `HH:MM:SS` time into seconds since midnight. Returns null when malformed. */
export function parseGtfsTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3])
  if (minutes > 59 || seconds > 59) return null
  return hours * 3600 + minutes * 60 + seconds
}

export interface ParisClock {
  /** GTFS service date, formatted YYYYMMDD. */
  serviceDate: string
  /** Seconds elapsed since midnight in Europe/Paris. */
  secondsSinceMidnight: number
  /** Lowercase weekday name matching the `calendar` table columns. */
  weekday: WeekdayKey
}

/** Resolve the current date/time in Europe/Paris, independent of the server time zone. */
export function parisClock(now: Date = new Date()): ParisClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PARIS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value ?? '00'

  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: PARIS_TZ, weekday: 'long' })
    .format(now)
    .toLowerCase() as WeekdayKey

  return {
    serviceDate: `${get('year')}${get('month')}${get('day')}`,
    secondsSinceMidnight:
      Number(get('hour')) * 3600 + Number(get('minute')) * 60 + Number(get('second')),
    weekday,
  }
}
