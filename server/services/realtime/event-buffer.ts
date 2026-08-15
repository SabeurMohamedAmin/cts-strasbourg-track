/**
 * In-memory buffer of vehicle snapshots, shared by every producer/consumer:
 *
 *   producers:  server/services/realtime/poller.ts   → source 'live'
 *               server/api/stream/vehicles.get.ts    → source 'scheduled'
 *   consumers:  server/api/stream/vehicles.get.ts    (SSE + reconnect replay)
 *               server/api/vehicles.get.ts           (REST fallback)
 *
 * Strict real-time mode:
 *   Every published snapshot is tagged with its source so consumers can apply
 *   the strict rule — show ONLY real-time data whenever any live data exists,
 *   and theoretical schedules ONLY when live is completely unavailable.
 *   `latestLiveVehicleEvent()` is the single place that decides whether live
 *   data counts as "available": a live snapshot published within LIVE_FRESH_MS.
 */
import type { VehicleSnapshot } from '~~/shared/types/vehicle'

const MAX_EVENTS = 50

/**
 * A live snapshot counts as "available" for this long after being published.
 *
 * The poller publishes every 5 s while it has vehicles, so 60 s of silence
 * means the live pipeline is genuinely down (no token, CTS outage, or every
 * journey finished) — only then may the theoretical schedule take over.
 * Aligned with DATA_STALE_AFTER_MS in poller.ts.
 */
export const LIVE_FRESH_MS = 60_000

/** Which pipeline produced a snapshot. */
export type SnapshotSource = 'live' | 'scheduled'

export interface VehicleStreamEvent {
  id: number
  source: SnapshotSource
  snapshot: VehicleSnapshot
}

let nextId = 1
const events: VehicleStreamEvent[] = []

/** Epoch ms of the most recent 'live' publication. 0 = never. */
let lastLivePublishedAt = 0

export function publishVehicleSnapshot(
  snapshot: VehicleSnapshot,
  source: SnapshotSource,
): VehicleStreamEvent {
  const event = { id: nextId++, source, snapshot }
  events.push(event)
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS)
  if (source === 'live') lastLivePublishedAt = Date.now()
  return event
}

export function latestVehicleEvent(): VehicleStreamEvent | undefined {
  return events.at(-1)
}

/**
 * The latest LIVE snapshot, or undefined when live data is unavailable
 * (never published, or last published more than LIVE_FRESH_MS ago).
 *
 * @param nowMs injectable clock for unit tests; defaults to Date.now().
 */
export function latestLiveVehicleEvent(nowMs = Date.now()): VehicleStreamEvent | undefined {
  if (lastLivePublishedAt === 0 || nowMs - lastLivePublishedAt > LIVE_FRESH_MS) {
    return undefined
  }
  // Walk backwards: the freshest live event is near the end of the buffer.
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]!
    if (event.source === 'live') return event
  }
  return undefined
}

export function vehicleEventsAfter(lastEventId: number): VehicleStreamEvent[] {
  if (!Number.isSafeInteger(lastEventId) || lastEventId < 0) return []
  return events.filter(event => event.id > lastEventId)
}
