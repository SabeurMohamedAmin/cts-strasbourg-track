import { getScheduledSnapshot } from '../../services/simulation/scheduled-vehicles'
import {
  latestLiveVehicleEvent,
  latestVehicleEvent,
  publishVehicleSnapshot,
  vehicleEventsAfter,
  type VehicleStreamEvent,
} from '../../services/realtime/event-buffer'

/**
 * SSE endpoint — streams vehicle snapshots + heartbeats.
 *
 * Strict real-time mode:
 *   On every tick the stream forwards the latest LIVE snapshot published by
 *   the CTS poller whenever one is fresh. A theoretical snapshot (GTFS
 *   schedule simulation) is generated and sent ONLY when live data is
 *   completely unavailable — never alongside it. Because each snapshot fully
 *   replaces the previous vehicle list on the client, live and theoretical
 *   vehicles can never be mixed on the map, even when some lines lack live
 *   coverage.
 *
 * Recent snapshots are retained in memory so EventSource reconnects can replay
 * events after Last-Event-ID without changing the client contract.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const intervalMs = Number(config.pollIntervalMs) || 12_000

  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  const res = event.node.res
  let closed = false
  // Guards against re-sending the same buffer event on consecutive ticks
  // (e.g. the poller pausing while this stream keeps its own interval).
  let lastSentEventId = 0

  function sendVehicle(streamEvent: VehicleStreamEvent) {
    if (closed || streamEvent.id === lastSentEventId) return
    lastSentEventId = streamEvent.id
    res.write(`id: ${streamEvent.id}\nevent: vehicles\ndata: ${JSON.stringify(streamEvent.snapshot)}\n\n`)
  }

  function sendHeartbeat() {
    if (closed) return
    res.write(`event: heartbeat\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`)
  }

  async function pushSnapshot() {
    // Strict rule: live data, when fresh, is the single source of truth.
    const live = latestLiveVehicleEvent()
    if (live) {
      sendVehicle(live)
      return
    }

    // Live is completely unavailable → serve the theoretical schedule.
    try {
      sendVehicle(publishVehicleSnapshot(await getScheduledSnapshot(), 'scheduled'))
    }
    catch (error) {
      console.error('[sse] Failed to build vehicle snapshot', error)
    }
  }

  const lastEventId = Number.parseInt(getHeader(event, 'last-event-id') ?? '', 10)
  const replay = vehicleEventsAfter(lastEventId)
  if (replay.length) {
    replay.forEach(sendVehicle)
  }
  else {
    // Prefer a fresh live snapshot for the very first frame as well.
    const latest = latestLiveVehicleEvent() ?? latestVehicleEvent()
    if (latest) sendVehicle(latest)
    else await pushSnapshot()
  }

  const snapshotTimer = setInterval(pushSnapshot, intervalMs)
  const heartbeatTimer = setInterval(sendHeartbeat, 20_000)

  event.node.req.on('close', () => {
    closed = true
    clearInterval(snapshotTimer)
    clearInterval(heartbeatTimer)
  })
})
