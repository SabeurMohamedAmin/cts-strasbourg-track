/**
 * Nitro server plugin — warms the day-schedule cache at boot.
 *
 * Why: getDaySchedule() is lazy. Without this plugin, the FIRST request
 * that needs the schedule (stop arrivals, simulated vehicle positions)
 * triggers a heavy PostgreSQL load (~5 000+ trips, their stop times and
 * shape polylines) and waits several seconds for it.
 *
 * This plugin fires the load in the background right after the server
 * boots — deliberately NOT awaited, so boot itself stays instant — and
 * the first real request finds a warm in-memory cache.
 *
 * Failure is safe: schedule-cache resets itself on error, so the first
 * request simply falls back to the previous lazy-load behavior.
 */

import { parisClock } from '../services/simulation/gtfs-time'
import { getDaySchedule } from '../services/simulation/schedule-cache'

export default defineNitroPlugin(() => {
  const { serviceDate, weekday } = parisClock()

  console.info(`[schedule-warmup] Pre-loading schedule for ${serviceDate} in the background…`)

  // Fire-and-forget: never block server startup on this.
  // Two variants are warmed because getDaySchedule caches them separately:
  //   1. Full schedule (with route shapes)  — used by the vehicle simulation.
  //   2. Lightweight (without route shapes) — used by /api/stops/:id/arrivals.
  // Without #2 the FIRST favorites page load would still trigger the heavy
  // database load and wait several seconds for theoretical times.
  getDaySchedule(serviceDate, weekday)
    .then((schedule) => {
      console.info(`[schedule-warmup] Full schedule ready — ${schedule.trips.length} trips cached in memory.`)
    })
    .catch((error) => {
      console.error('[schedule-warmup] Full schedule failed (first request will retry lazily):', error)
    })

  getDaySchedule(serviceDate, weekday, true, false)
    .then((schedule) => {
      console.info(`[schedule-warmup] Arrivals schedule ready — ${schedule.trips.length} trips cached in memory.`)
    })
    .catch((error) => {
      console.error('[schedule-warmup] Arrivals schedule failed (first request will retry lazily):', error)
    })
})
