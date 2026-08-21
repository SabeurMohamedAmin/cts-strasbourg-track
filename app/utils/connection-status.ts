/**
 * Connection status mapping table (Step 4.2).
 *
 * Pure function: given the SSE connection state, the data freshness and
 * whether the snapshot only contains timetable (scheduled) vehicles,
 * return the label / icon / color shown in the drawer footer.
 *
 * Kept free of any store or Nuxt import so it can be unit-tested in a
 * plain Node environment (see tests/unit/connection-status.test.ts).
 *
 * Priority order (first match wins):
 *   1. connecting     — the SSE stream has not opened yet
 *   2. reconnecting   — the stream dropped, we are offline
 *   3. scheduled data — connected, but every vehicle runs on timetable data
 *   4. live / stale   — connected with real-time data (fresh or aging)
 */

// Type-only import: erased at compile time, so this file stays free of
// any runtime dependency on the Pinia store.
import type { ConnectionState } from '~/stores/vehicles'

export type Freshness = 'live' | 'stale'

export interface ConnectionStatus {
  label: string
  icon: string
  color: string
}

export function resolveConnectionStatus(
  connection: ConnectionState,
  freshness: Freshness,
  usesScheduledData: boolean,
): ConnectionStatus {
  if (connection === 'connecting') {
    return { label: 'Connexion…', icon: 'mdi-wifi-sync', color: 'grey' }
  }
  if (connection === 'reconnecting') {
    return { label: 'Hors ligne', icon: 'mdi-wifi-off', color: 'error' }
  }
  if (usesScheduledData) {
    return { label: 'Horaires théoriques', icon: 'mdi-calendar-clock', color: 'info' }
  }
  if (freshness === 'live') {
    return { label: 'Temps réel', icon: 'mdi-access-point', color: 'success' }
  }
  return { label: 'Données anciennes', icon: 'mdi-wifi-alert', color: 'warning' }
}
