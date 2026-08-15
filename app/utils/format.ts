import type { StopArrival } from '~~/shared/types/stop'

/**
 * Pure display formatters — extracted from StopSheet.vue (Phase 1, Step 1.2).
 * No Vue, no stores: every function is unit-testable in isolation.
 */

/** Clock time (HH:MM) in the Strasbourg timezone, e.g. "14:07". */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })
}

/**
 * Whole minutes from `now` until an ISO time, clamped at 0.
 * Single source of truth for every countdown in the app.
 * `now` is injectable (tests, reactive clock); defaults to the real clock.
 */
export function minutesUntil(iso: string, now: number = Date.now()): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - now) / 60_000))
}

/**
 * Human countdown until an arrival: "À quai", "1 min", "12 min".
 * Past times clamp to "À quai".
 */
export function relativeArrival(iso: string, now: number = Date.now()): string {
  const minutes = minutesUntil(iso, now)
  if (minutes === 0) return 'À quai'
  if (minutes === 1) return '1 min'
  return `${minutes} min`
}

/** Chip label for an arrival's data source. */
export function statusChipLabel(status: StopArrival['status']): string {
  return { scheduled: 'Théorique', estimated: 'Estimé', live: 'Temps réel' }[status]
}

/** Chip color for an arrival's data source. */
export function statusChipColor(status: StopArrival['status']): string {
  return { scheduled: 'grey', estimated: 'orange', live: 'green' }[status]
}

/** "250 m" under one kilometre, "1.3 km" from there on. */
export function formatDistanceM(meters: number): string {
  return meters < 1_000 ? `${Math.round(meters)} m` : `${(meters / 1_000).toFixed(1)} km`
}

/**
 * CSS custom properties driving the line chip colours.
 * GTFS colours may be empty strings — fall back to CTS red on white.
 */
export function lineStyle(line: { routeColor: string, routeTextColor: string }) {
  return {
    '--line-color': `#${line.routeColor || 'c8102e'}`,
    '--line-text': `#${line.routeTextColor || 'ffffff'}`,
  }
}
