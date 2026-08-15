import { VehicleSnapshotSchema } from '~~/shared/schemas/vehicle'
import { useVehiclesStore } from '~/stores/vehicles'
import { usePageVisibility } from '~/composables/usePageVisibility'

/** Consider the stream broken when nothing (snapshot or heartbeat) arrived for this long. */
const STALE_AFTER_MS = 60_000
const STALE_CHECK_INTERVAL_MS = 30_000

/**
 * Subscribes to the vehicle SSE stream and feeds the vehicles store.
 *
 * Fixes applied 2026-07-12:
 * - The EventSource is CLOSED when the tab goes hidden and REOPENED on return.
 *   Leaving an SSE connection open while the page is invisible caused the server
 *   to keep pushing snapshots, the store to keep updating, and the rAF loop in
 *   useVehicleLayer to keep burning GPU — eventually freezing the whole machine.
 * - staleTimer is guarded so it is only created after a successful connect().
 * - EventSource reconnects automatically on network errors; we only surface
 *   the connection state to the UI.
 */
export function useVehicleStream() {
  const store = useVehiclesStore()
  const { isVisible } = usePageVisibility()

  let source: EventSource | null = null
  let staleTimer: ReturnType<typeof setInterval> | null = null
  let fallbackInFlight = false
  let lastReceivedAt = 0
  let stopWatchingVisibility: (() => void) | null = null

  function handleSnapshot(rawData: string) {
    try {
      const snapshot = VehicleSnapshotSchema.parse(JSON.parse(rawData))
      store.applySnapshot(snapshot)
    }
    catch (error) {
      console.error('[vehicle-stream] Invalid snapshot payload', error)
    }
  }

  function connect() {
    // Guard: never open a second connection.
    if (source) return

    store.setConnection('connecting')
    lastReceivedAt = Date.now()

    source = new EventSource('/api/stream/vehicles')

    source.onopen = () => {
      lastReceivedAt = Date.now()
      store.setConnection('open')
    }

    source.onerror = () => {
      store.setConnection('reconnecting')
      // Only trigger the REST fallback if we've been dark for a while.
      // The browser will retry the EventSource automatically.
      if (Date.now() - lastReceivedAt > STALE_AFTER_MS) {
        fetchFallbackSnapshot()
      }
    }

    source.addEventListener('vehicles', (event) => {
      lastReceivedAt = Date.now()
      handleSnapshot((event as MessageEvent<string>).data)
    })

    source.addEventListener('heartbeat', () => {
      lastReceivedAt = Date.now()
    })
  }

  function disconnect() {
    source?.close()
    source = null
    store.setConnection('reconnecting')
  }

  async function fetchFallbackSnapshot() {
    if (fallbackInFlight) return
    fallbackInFlight = true
    try {
      const snapshot = VehicleSnapshotSchema.parse(await $fetch('/api/vehicles'))
      store.applySnapshot(snapshot)
      lastReceivedAt = Date.now()
    }
    catch (error) {
      console.error('[vehicle-stream] REST fallback failed', error)
    }
    finally {
      fallbackInFlight = false
    }
  }

  onMounted(() => {
    connect()

    // Stale-connection watchdog — only runs while visible.
    staleTimer = setInterval(() => {
      if (!document.hidden && Date.now() - lastReceivedAt > STALE_AFTER_MS) {
        fetchFallbackSnapshot()
      }
    }, STALE_CHECK_INTERVAL_MS)

    // Close the SSE socket when the tab is hidden; reopen when it returns.
    // This is the primary fix: an open socket while hidden keeps the server
    // pushing, which keeps the Vue store updating, which keeps the rAF loop
    // painting — eventually saturating the GPU and freezing the machine.
    stopWatchingVisibility = watch(isVisible, (visible) => {
      if (visible) {
        connect()
        // Immediately fetch a fresh snapshot so the map isn't stale on resume.
        fetchFallbackSnapshot()
      }
      else {
        disconnect()
      }
    })
  })

  onBeforeUnmount(() => {
    disconnect()
    if (staleTimer) {
      clearInterval(staleTimer)
      staleTimer = null
    }
    stopWatchingVisibility?.()
    stopWatchingVisibility = null
  })
}
