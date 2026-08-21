/**
 * StopMonitoring service — real-time departures for a single stop.
 *
 * Sits between the arrivals API route and the raw CTS client:
 *
 *   arrivals.get.ts → getMonitoredArrivals(stopRef)
 *                       ├─ 30 s in-memory cache — protects the CTS API
 *                       │  quota: each browser polls every 30 s and several
 *                       │  browsers can watch the same stop simultaneously.
 *                       ├─ cts-client.ts        fetchStopMonitoring() → XML
 *                       └─ stop-monitoring-parser.ts → MonitoredArrival[]
 *
 * Returns `null` (not an empty array) when real-time data is unavailable
 * (no token configured, network error, CTS outage) so the caller can tell
 * "no data source" apart from "no upcoming vehicles".
 */

import { fetchStopMonitoring, isCtsTokenConfigured } from './cts-client'
import { parseSiriStopMonitoring, type MonitoredArrival } from './stop-monitoring-parser'

const CACHE_TTL_MS = 30_000
const FAILURE_CACHE_TTL_MS = 30_000
const MAX_CONCURRENT_REQUESTS = 3

/**
 * Circuit breaker — if CTS fails this many times in a row (whatever the
 * stop), we assume the whole service is down and stop calling it for
 * CIRCUIT_OPEN_MS. Without this, EVERY stop pays its own network timeout
 * during a CTS outage, which froze the favorites pages.
 */
const CIRCUIT_FAILURE_THRESHOLD = 3
const CIRCUIT_OPEN_MS = 60_000

/** Safety bound — the CTS network has well under 1 500 stop points. */
const CACHE_MAX_ENTRIES = 1_500

interface CacheEntry {
  fetchedAt: number
  arrivals: MonitoredArrival[] | null
}

interface StopMonitoringState {
  cache: Map<string, CacheEntry>
  inFlight: Map<string, Promise<MonitoredArrival[] | null>>
  activeRequests: number
  waiters: Array<() => void>
  /** Upstream failures in a row, across ALL stops. Reset on any success. */
  consecutiveFailures: number
  /** While Date.now() < this timestamp, the circuit is open: CTS is skipped. */
  circuitOpenUntil: number
}

// Nitro dev rebuilds can re-evaluate this module while old requests are still
// running. Keeping the limiter on globalThis preserves one process-wide quota.
const STATE_KEY = '__ctsStopMonitoringState'
const globalRegistry = globalThis as typeof globalThis & {
  [STATE_KEY]?: StopMonitoringState
}
const state = globalRegistry[STATE_KEY] ??= {
  cache: new Map<string, CacheEntry>(),
  inFlight: new Map<string, Promise<MonitoredArrival[] | null>>(),
  activeRequests: 0,
  waiters: [],
  consecutiveFailures: 0,
  circuitOpenUntil: 0,
}
// Dev-only safety: a hot reload can keep an older state object alive that
// predates the circuit-breaker fields. Give them a default in that case.
state.consecutiveFailures ??= 0
state.circuitOpenUntil ??= 0

async function acquireRequestSlot(): Promise<void> {
  if (state.activeRequests < MAX_CONCURRENT_REQUESTS) {
    state.activeRequests++
    return
  }

  await new Promise<void>(resolve => state.waiters.push(resolve))
  state.activeRequests++
}

function releaseRequestSlot(): void {
  state.activeRequests = Math.max(0, state.activeRequests - 1)
  state.waiters.shift()?.()
}

async function fetchAndCache(stopRef: string): Promise<MonitoredArrival[] | null> {
  await acquireRequestSlot()
  try {
    const body = await fetchStopMonitoring(stopRef)
    const arrivals = parseSiriStopMonitoring(body)

    if (state.cache.size >= CACHE_MAX_ENTRIES) state.cache.clear()
    state.cache.set(stopRef, { fetchedAt: Date.now(), arrivals })
    state.consecutiveFailures = 0 // CTS is healthy again → keep the circuit closed
    return arrivals
  }
  catch (err) {
    // Negative caching prevents every browser refresh from immediately retrying
    // an unavailable or rate-limited upstream service.
    state.cache.set(stopRef, { fetchedAt: Date.now(), arrivals: null })
    state.consecutiveFailures++
    if (state.consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
      // CTS looks down for everyone: open the circuit so upcoming calls
      // return `null` instantly instead of each waiting for its own timeout.
      state.circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS
      console.warn(`[stop-monitoring] Circuit opened for ${CIRCUIT_OPEN_MS / 1_000} s after ${state.consecutiveFailures} consecutive CTS failures`)
    }
    console.warn(`[stop-monitoring] Real-time fetch failed for ${stopRef}:`, err)
    return null
  }
  finally {
    releaseRequestSlot()
  }
}

export async function getMonitoredArrivals(
  stopRef: string,
  bypassCache = false,
): Promise<MonitoredArrival[] | null> {
  if (!isCtsTokenConfigured()) return null

  // Circuit open → CTS is considered down: skip the network entirely.
  // Callers immediately fall back to the GTFS schedule ("Horaires théoriques").
  // Once the window expires, the next call retries CTS; a single new failure
  // re-opens the circuit right away (half-open behaviour).
  if (Date.now() < state.circuitOpenUntil) return null

  const hit = state.cache.get(stopRef)
  const hitTtl = hit?.arrivals === null ? FAILURE_CACHE_TTL_MS : CACHE_TTL_MS
  if (!bypassCache && hit && Date.now() - hit.fetchedAt < hitTtl) return hit.arrivals

  // All callers asking for the same platform share one upstream request. This
  // covers concurrent page loads and multiple browser tabs in this process.
  const existingRequest = state.inFlight.get(stopRef)
  if (existingRequest) return existingRequest

  const request = fetchAndCache(stopRef)
  state.inFlight.set(stopRef, request)
  try {
    return await request
  }
  finally {
    state.inFlight.delete(stopRef)
  }
}
