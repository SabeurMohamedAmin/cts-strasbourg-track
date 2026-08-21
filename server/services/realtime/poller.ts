/**
 * CTS real-time poller — singleton running in the Nitro server process.
 *
 * Two independent loops:
 *
 *   FETCH loop (every NUXT_POLL_INTERVAL_MS, default 12 s)
 *     1. Fetch EstimatedTimetable XML from the CTS REST API.
 *     2. Parse SIRI 2.0 XML → ParsedVehicle[] with full call sequences
 *        (siri-parser.ts) and cache the result in memory.
 *
 *   POSITION loop (every 5 s)
 *     3. Re-interpolate every cached vehicle's position "as of now" from its
 *        real-time call times (live-position.ts) — CTS provides no GPS, so
 *        the position is derived from the expected times between the last
 *        passed stop and the next stop.
 *     4. Publish a VehicleSnapshot to the event buffer for SSE clients.
 *
 * Position priority per vehicle:
 *   1. GPS from the feed (rare on CTS, but most accurate when present)
 *   2. Time interpolation between calls  ← the normal case
 *   3. Snap to the next announced stop   ← degraded fallback
 *   4. Skip the vehicle (cannot be placed on the map)
 *
 * Freshness: if the CTS feed stops answering, cached vehicles keep moving on
 * their last known times but the snapshot is flagged `stale` after 60 s so
 * the UI can inform the user. Finished journeys are dropped after 2 min.
 *
 * The poller is started once by server/plugins/poller.ts on boot.
 * If NUXT_CTS_API_TOKEN is not set, the poller is a no-op and the app
 * falls back to the schedule simulation transparently.
 */

import { useRuntimeConfig } from '#imports'
import type { LiveVehicle, VehicleSnapshot } from '~~/shared/types/vehicle'
import { getStopCoords } from '../../database/stop-coords'
import { fetchEstimatedTimetable, isCtsTokenConfigured } from './cts-client'
import { publishVehicleSnapshot } from './event-buffer'
import { interpolatePosition, type TimedPoint } from './live-position'
import {
  parseSiriEstimatedTimetable,
  type ParsedCall,
  type ParsedVehicle,
} from './siri-parser'

/** How often positions are re-interpolated between two CTS fetches. */
const POSITION_REFRESH_MS = 5_000
/** Snapshot is flagged `stale` when the last successful fetch is older. */
const DATA_STALE_AFTER_MS = 60_000
/** Journeys whose last call ended longer ago than this are dropped. */
const FINISHED_JOURNEY_GRACE_MS = 120_000

let fetchTimer: ReturnType<typeof setInterval> | null = null
let positionTimer: ReturnType<typeof setInterval> | null = null
let fetchInProgress = false

/** Last successfully parsed SIRI journeys (the working set). */
let lastParsed: ParsedVehicle[] = []
let lastFetchAt = 0

/**
 * True once the "all vehicles dropped" warning has been logged. Prevents
 * the position loop from repeating it every 5 s during a database outage.
 */
let allDroppedWarned = false

const round6 = (v: number) => Math.round(v * 1e6) / 1e6

function parseMs(iso: string | null): number | undefined {
  if (!iso) return undefined
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : undefined
}

/**
 * Resolve each call's stop coordinates (GTFS stop table, cached in-process)
 * and epoch times. Calls without coordinates or times are skipped.
 */
async function toTimedPoints(calls: ParsedCall[]): Promise<TimedPoint[]> {
  const points: TimedPoint[] = []

  for (const call of calls) {
    const coords = await getStopCoords(call.stopRef)
    if (!coords) continue

    const arrivalMs = parseMs(call.expectedArrival) ?? parseMs(call.expectedDeparture)
    if (arrivalMs === undefined) continue
    const departureMs = Math.max(parseMs(call.expectedDeparture) ?? arrivalMs, arrivalMs)

    points.push({
      lon: coords.lon,
      lat: coords.lat,
      arrivalMs,
      departureMs,
      stopRef: call.stopRef,
      stopName: call.stopName,
    })
  }

  return points
}

/**
 * Turn one parsed SIRI journey into a plottable LiveVehicle,
 * or null when no position can be resolved.
 */
async function toLiveVehicle(v: ParsedVehicle, nowMs: number): Promise<LiveVehicle | null> {
  // Strip parser-only fields; keep everything else as-is.
  const { nextStopRef, calls, latitude, longitude, ...base } = v

  // 1. Real GPS from the feed — rare on CTS but most accurate when present.
  if (latitude !== null && longitude !== null) {
    return { ...base, latitude, longitude }
  }

  // 2. Interpolate between the last passed stop and the next one.
  const points = await toTimedPoints(calls)

  // Drop journeys that finished a while ago (terminus reached).
  const lastPoint = points[points.length - 1]
  if (lastPoint && nowMs > lastPoint.departureMs + FINISHED_JOURNEY_GRACE_MS) return null

  const position = interpolatePosition(points, nowMs)
  if (position) {
    const next = points[position.nextIndex]
    return {
      ...base,
      latitude: round6(position.lat),
      longitude: round6(position.lon),
      bearing: position.bearing,
      // Straight forward segment towards the next SIRI call — only when the
      // vehicle is strictly travelling. It lets a first-seen vehicle start
      // moving immediately on the client (dead reckoning) instead of
      // standing still until the second snapshot. Dwelling vehicles get no
      // pathAhead and correctly stay put.
      pathAhead: position.travelling && next
        ? [
            [round6(position.lon), round6(position.lat)],
            [next.lon, next.lat],
          ]
        : undefined,
      nextStop: next
        ? {
            id: next.stopRef,
            name: next.stopName || next.stopRef,
            expectedArrival: new Date(next.arrivalMs).toISOString(),
          }
        : base.nextStop,
    }
  }

  // 3. Degraded fallback: snap to the next announced stop.
  if (nextStopRef) {
    const coords = await getStopCoords(nextStopRef)
    if (coords) return { ...base, latitude: coords.lat, longitude: coords.lon }
  }

  // 4. Nothing to plot.
  return null
}

/** Interpolate the cached journeys "as of now" and publish a snapshot. */
async function publishInterpolated(): Promise<void> {
  if (!lastParsed.length) return

  const nowMs = Date.now()
  const vehicles: LiveVehicle[] = []

  for (const parsed of lastParsed) {
    try {
      const vehicle = await toLiveVehicle(parsed, nowMs)
      if (vehicle) vehicles.push(vehicle)
    }
    catch (err) {
      // One bad journey must never take down the whole snapshot.
      console.warn(`[poller] Skipped vehicle ${parsed.id}:`, err)
    }
  }

  if (!vehicles.length) {
    if (!allDroppedWarned) {
      console.warn(
        '[poller] All vehicles dropped (no position resolved). '
        + 'Suppressing repeats until positions resolve again.',
      )
      allDroppedWarned = true
    }
    return
  }

  if (allDroppedWarned) {
    console.info(`[poller] Vehicle positions resolved again (${vehicles.length} vehicles).`)
    allDroppedWarned = false
  }

  const snapshot: VehicleSnapshot = {
    freshness: nowMs - lastFetchAt > DATA_STALE_AFTER_MS ? 'stale' : 'live',
    recordedAt: new Date(nowMs).toISOString(),
    lastSuccessfulUpdate: new Date(lastFetchAt).toISOString(),
    vehicles,
  }

  publishVehicleSnapshot(snapshot, 'live')
}

/** Fetch + parse the CTS feed, then publish immediately. */
async function fetchOnce(): Promise<void> {
  // A slow upstream response may take longer than the polling interval. Never
  // stack concurrent requests: they increase load and tend to time out together.
  if (fetchInProgress) return
  fetchInProgress = true

  try {
    const xml = await fetchEstimatedTimetable()
    const parsed = parseSiriEstimatedTimetable(xml)

    if (parsed.length) {
      lastParsed = parsed
      lastFetchAt = Date.now()
      console.info(`[poller] Fetched ${parsed.length} vehicle journeys from CTS.`)
    }
    else {
      console.warn('[poller] No vehicle journeys in SIRI response.')
    }
  }
  catch (err) {
    // Keep the previous working set — positions keep interpolating and the
    // snapshot will flip to `stale` after DATA_STALE_AFTER_MS.
    console.error('[poller] Poll failed:', err)
  }
  finally {
    fetchInProgress = false
  }

  await publishInterpolated()
}

/**
 * Dev-server note: every Nitro rebuild re-evaluates this module, which
 * resets the local timer variables while the OLD intervals keep running —
 * resulting in two pollers hitting the CTS API and publishing competing
 * snapshots. To guarantee a single poller per process, timers are also
 * registered on globalThis and any previous ones are cleared on start.
 */
const TIMER_REGISTRY_KEY = '__ctsPollerTimers'

interface TimerRegistry {
  fetch: ReturnType<typeof setInterval>
  position: ReturnType<typeof setInterval>
}

export function startPoller(): void {
  const registry = globalThis as Record<string, any>

  // Kill timers left over from a previous dev rebuild or a double start.
  const previous = registry[TIMER_REGISTRY_KEY] as TimerRegistry | undefined
  if (previous) {
    clearInterval(previous.fetch)
    clearInterval(previous.position)
    registry[TIMER_REGISTRY_KEY] = undefined
  }

  if (!isCtsTokenConfigured()) {
    console.warn(
      '[poller] NUXT_CTS_API_TOKEN is not set — '
      + 'falling back to schedule simulation.',
    )
    return
  }

  const config = useRuntimeConfig()
  const intervalMs = Number(config.pollIntervalMs) || 12_000

  console.info(
    `[poller] Starting CTS poller: fetch every ${intervalMs} ms, `
    + `positions every ${POSITION_REFRESH_MS} ms.`,
  )

  fetchOnce() // immediate first fetch
  fetchTimer = setInterval(fetchOnce, intervalMs)
  positionTimer = setInterval(publishInterpolated, POSITION_REFRESH_MS)
  registry[TIMER_REGISTRY_KEY] = { fetch: fetchTimer, position: positionTimer }
}

export function stopPoller(): void {
  const registry = globalThis as Record<string, any>
  const timers = registry[TIMER_REGISTRY_KEY] as TimerRegistry | undefined
  if (timers) {
    clearInterval(timers.fetch)
    clearInterval(timers.position)
    registry[TIMER_REGISTRY_KEY] = undefined
  }
  if (fetchTimer) {
    clearInterval(fetchTimer)
    fetchTimer = null
  }
  if (positionTimer) {
    clearInterval(positionTimer)
    positionTimer = null
  }
}
