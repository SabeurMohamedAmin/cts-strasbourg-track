/**
 * Time helpers for the timetables.
 * Pure functions: no Vue, no store, easy to read and to unit test.
 *
 * Everything is computed in the Strasbourg timezone (Europe/Paris), never in the
 * timezone of the machine: the server runs in UTC, the reader does not.
 */

/** Seconds elapsed since midnight in Strasbourg. 14:30:00 gives 52200. */
export function secondsSinceMidnightInParis(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const read = (unit: string) => Number(parts.find(part => part.type === unit)?.value ?? 0)

  return read('hour') * 3600 + read('minute') * 60 + read('second')
}

/** Hour of the day in Strasbourg, 0 to 23. */
export function hourInParis(date: Date): number {
  return Math.floor(secondsSinceMidnightInParis(date) / 3600)
}

/** Service date for the reader: "2026-08-15" gives "15/8/2026". */
export function formatServiceDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return year ? `${day}/${month}/${year}` : ''
}
