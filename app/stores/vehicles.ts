import { defineStore } from 'pinia'
import type { LiveVehicle, VehicleSnapshot } from '~~/shared/types/vehicle'

export type ConnectionState = 'connecting' | 'open' | 'reconnecting'

export const useVehiclesStore = defineStore('vehicles', () => {
  const vehicles = ref<LiveVehicle[]>([])
  const selectedVehicleId = ref<string | null>(null)
  const freshness = ref<'live' | 'stale'>('live')
  const connection = ref<ConnectionState>('connecting')
  const lastUpdate = ref<string | null>(null)

  const selectedVehicle = computed(
    () => vehicles.value.find(v => v.id === selectedVehicleId.value) ?? null,
  )

  function applySnapshot(snapshot: VehicleSnapshot) {
    vehicles.value = snapshot.vehicles
    freshness.value = snapshot.freshness
    lastUpdate.value = snapshot.recordedAt
  }

  function setConnection(state: ConnectionState) {
    connection.value = state
  }

  function selectVehicle(id: string) {
    selectedVehicleId.value = id
  }

  function clearSelection() {
    selectedVehicleId.value = null
  }

  return {
    vehicles,
    selectedVehicleId,
    selectedVehicle,
    freshness,
    connection,
    lastUpdate,
    applySnapshot,
    setConnection,
    selectVehicle,
    clearSelection,
  }
})
