import { describe, expect, it } from 'vitest'
import type { LiveVehicle } from '~~/shared/types/vehicle'
import {
  initialVehicleTween,
  MAX_INITIAL_TWEEN_MS,
  MIN_INITIAL_TWEEN_MS,
} from '~/utils/vehicle-tween'

/** Fixed reference clock so ETA-based durations are deterministic. */
const NOW = new Date('2026-07-14T10:00:00Z').getTime()
const isoIn = (seconds: number) => new Date(NOW + seconds * 1_000).toISOString()

/** Forward geometry from the vehicle towards its next stop. */
const PATH_AHEAD: [number, number][] = [
  [7.750, 48.580],
  [7.755, 48.582],
  [7.760, 48.585],
]

function makeVehicle(overrides: Partial<LiveVehicle> = {}): LiveVehicle {
  return {
    id: 'sim-trip-1',
    mode: 'tram',
    lineId: 'A',
    lineLabel: 'A',
    destination: 'Parc des Sports',
    latitude: 48.580,
    longitude: 7.750,
    status: 'scheduled',
    recordedAt: isoIn(0),
    ...overrides,
  }
}

describe('initialVehicleTween', () => {
  it('walks pathAhead towards the next stop, paced by its ETA', () => {
    const vehicle = makeVehicle({
      pathAhead: PATH_AHEAD,
      nextStop: { id: 'stop-1', name: 'Homme de Fer', expectedArrival: isoIn(45) },
    })

    const tween = initialVehicleTween(vehicle, NOW)

    expect(tween).not.toBeNull()
    expect(tween!.path).toEqual(PATH_AHEAD)
    expect(tween!.durationMs).toBe(45_000)
  })

  it('keeps dwelling vehicles still (server ships no pathAhead)', () => {
    const vehicle = makeVehicle({
      nextStop: { id: 'stop-1', name: 'Homme de Fer', expectedArrival: isoIn(45) },
    })

    expect(initialVehicleTween(vehicle, NOW)).toBeNull()
  })

  it('ignores a degenerate single-point pathAhead', () => {
    const vehicle = makeVehicle({
      pathAhead: [[7.750, 48.580]],
      nextStop: { id: 'stop-1', name: 'Homme de Fer', expectedArrival: isoIn(45) },
    })

    expect(initialVehicleTween(vehicle, NOW)).toBeNull()
  })

  it('stays put when there is no next stop at all', () => {
    const vehicle = makeVehicle({ pathAhead: PATH_AHEAD })

    expect(initialVehicleTween(vehicle, NOW)).toBeNull()
  })

  it('stays put when the next stop has no ETA', () => {
    const vehicle = makeVehicle({
      pathAhead: PATH_AHEAD,
      nextStop: { id: 'stop-1', name: 'Homme de Fer' },
    })

    expect(initialVehicleTween(vehicle, NOW)).toBeNull()
  })

  it('stays put when the ETA is unparseable', () => {
    const vehicle = makeVehicle({
      pathAhead: PATH_AHEAD,
      nextStop: { id: 'stop-1', name: 'Homme de Fer', expectedArrival: 'not-a-date' },
    })

    expect(initialVehicleTween(vehicle, NOW)).toBeNull()
  })

  it('stays put when the ETA is already in the past', () => {
    const vehicle = makeVehicle({
      pathAhead: PATH_AHEAD,
      nextStop: { id: 'stop-1', name: 'Homme de Fer', expectedArrival: isoIn(-10) },
    })

    expect(initialVehicleTween(vehicle, NOW)).toBeNull()
  })

  it('clamps a nearly-due ETA up to the minimum duration', () => {
    const vehicle = makeVehicle({
      pathAhead: PATH_AHEAD,
      nextStop: {
        id: 'stop-1',
        name: 'Homme de Fer',
        expectedArrival: new Date(NOW + 200).toISOString(),
      },
    })

    const tween = initialVehicleTween(vehicle, NOW)

    expect(tween).not.toBeNull()
    expect(tween!.durationMs).toBe(MIN_INITIAL_TWEEN_MS)
  })

  it('clamps a far-away ETA down to the maximum duration', () => {
    const vehicle = makeVehicle({
      pathAhead: PATH_AHEAD,
      nextStop: { id: 'stop-1', name: 'Homme de Fer', expectedArrival: isoIn(600) },
    })

    const tween = initialVehicleTween(vehicle, NOW)

    expect(tween).not.toBeNull()
    expect(tween!.durationMs).toBe(MAX_INITIAL_TWEEN_MS)
  })
})
