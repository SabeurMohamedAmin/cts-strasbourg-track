export type VehicleMode = 'bus' | 'tram'
export type VehicleStatus = 'live' | 'estimated' | 'scheduled'

export interface NextStop {
  id: string
  name: string
  expectedArrival?: string
}

export interface LiveVehicle {
  id: string
  mode: VehicleMode
  lineId: string
  lineLabel: string
  destination: string
  latitude: number
  longitude: number
  bearing?: number
  delaySeconds?: number
  status: VehicleStatus
  nextStop?: NextStop
  recordedAt: string
  /**
   * Ordered [lon, lat] waypoints from the GTFS shape traversed between
   * recent positions, ending at this snapshot's vehicle position.
   *
   * The client trims the polyline from its currently rendered position and
   * follows the remaining geometry. This keeps tram markers on their rails
   * through curves instead of taking a straight shortcut between stops.
   *
   * Omitted for live SIRI vehicles (Phase E) and buses with no shape.
   */
  shapePath?: [number, number][]
  /**
   * Ordered [lon, lat] waypoints from this snapshot's position FORWARD to
   * the vehicle's next stop.
   *
   * On a vehicle's first sighting the client has no previous position to
   * tween from, so it dead-reckons along this path with a duration equal to
   * the next stop's ETA minus now (see app/utils/vehicle-tween.ts). This
   * makes vehicles move immediately on first render instead of standing
   * still until the second snapshot arrives.
   *
   * Omitted when the vehicle is dwelling at a stop — it must stay put.
   */
  pathAhead?: [number, number][]
}

export interface VehicleSnapshot {
  freshness: 'live' | 'stale'
  recordedAt: string
  lastSuccessfulUpdate?: string
  vehicles: LiveVehicle[]
}
