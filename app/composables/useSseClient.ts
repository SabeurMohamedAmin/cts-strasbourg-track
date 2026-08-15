/**
 * useSseClient — wraps the browser EventSource with:
 *   - Automatic reconnection with exponential back-off (max 30 s).
 *   - `Last-Event-ID` header replay: the EventSource spec sends this
 *     automatically when the server assigns event IDs, which lets the
 *     server ring-buffer replay missed events (Phase I).
 *   - Visibility-aware: pauses reconnection attempts while the tab is hidden.
 *   - Cleans up on component unmount.
 *
 * Usage:
 *   const { data, status } = useSseClient('/api/live/vehicles')
 */
import { usePageVisibility } from '~/composables/usePageVisibility'

type SseStatus = 'connecting' | 'connected' | 'reconnecting' | 'closed'

export function useSseClient<T = unknown>(url: string) {
  const data = ref<T | null>(null)
  const status = ref<SseStatus>('connecting')
  const { isVisible } = usePageVisibility()

  let es: EventSource | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let attempt = 0

  function backoffMs(): number {
    // Exponential back-off: 1 s, 2 s, 4 s … capped at 30 s.
    return Math.min(30_000, 1_000 * 2 ** attempt)
  }

  function connect() {
    if (es) {
      es.close()
      es = null
    }

    status.value = attempt === 0 ? 'connecting' : 'reconnecting'

    // The browser sends `Last-Event-ID` automatically when the server has
    // previously assigned IDs via the `id:` SSE field.  No manual header
    // injection is needed — this is part of the EventSource spec.
    es = new EventSource(url)

    es.onopen = () => {
      status.value = 'connected'
      attempt = 0 // reset back-off on successful connection
    }

    es.onmessage = (event) => {
      try {
        data.value = JSON.parse(event.data) as T
      }
      catch {
        // Ignore malformed JSON — the server should never send it, but
        // we do not want a parse error to kill the composable.
        console.warn('[useSseClient] Could not parse SSE message', event.data)
      }
    }

    es.onerror = () => {
      es?.close()
      es = null
      status.value = 'reconnecting'
      attempt++
      scheduleReconnect()
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (!isVisible.value) return // defer until the tab is visible again
    reconnectTimer = setTimeout(connect, backoffMs())
  }

  function close() {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = null
    es?.close()
    es = null
    status.value = 'closed'
  }

  // Resume reconnection when the user returns to the tab.
  watch(isVisible, (visible) => {
    if (visible && (status.value === 'reconnecting' || es === null)) {
      scheduleReconnect()
    }
  })

  onMounted(connect)
  onUnmounted(close)

  return { data: readonly(data), status: readonly(status), reconnect: connect, close }
}
