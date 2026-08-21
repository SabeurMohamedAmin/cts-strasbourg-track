import { useVehiclesStore } from '~/stores/vehicles'
import { resolveConnectionStatus } from '~/utils/connection-status'

/**
 * useConnectionStatus (Step 4.2)
 *
 * Derives the drawer-footer connection indicator from the vehicles store.
 * The label/icon/color mapping itself is a pure function in
 * app/utils/connection-status.ts — this composable only wires it to the
 * store with reactive computeds.
 */
export function useConnectionStatus() {
  const vehiclesStore = useVehiclesStore()

  // A snapshot is "scheduled" when every vehicle runs on timetable data
  // (no real-time feed available for any of them).
  const usesScheduledData = computed(() =>
    vehiclesStore.vehicles.length > 0
    && vehiclesStore.vehicles.every(v => v.status === 'scheduled'),
  )

  const status = computed(() => resolveConnectionStatus(
    vehiclesStore.connection,
    vehiclesStore.freshness,
    usesScheduledData.value,
  ))

  const connectionLabel = computed(() => status.value.label)
  const connectionIcon = computed(() => status.value.icon)
  const connectionColor = computed(() => status.value.color)

  return { usesScheduledData, connectionLabel, connectionIcon, connectionColor }
}
