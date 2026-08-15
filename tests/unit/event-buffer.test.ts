import { describe, expect, it, vi } from 'vitest'
import type { VehicleSnapshot } from '~~/shared/types/vehicle'

/**
 * Unit tests for the strict real-time selection in the event buffer:
 * live snapshots are the single source of truth while fresh; scheduled
 * snapshots must never be picked up by latestLiveVehicleEvent().
 *
 * The buffer keeps state at module scope, so each test re-imports a
 * fresh copy via vi.resetModules().
 */

function makeSnapshot(status: 'live' | 'scheduled'): VehicleSnapshot {
  const now = new Date().toISOString()
  return {
    freshness: 'live',
    recordedAt: now,
    vehicles: [
      {
        id: status === 'live' ? 'cts-1' : 'sim-1',
        mode: 'tram',
        lineId: 'A',
        lineLabel: 'A',
        destination: 'Illkirch',
        latitude: 48.58,
        longitude: 7.75,
        status,
        recordedAt: now,
      },
    ],
  }
}

async function freshBuffer() {
  vi.resetModules()
  return await import('~~/server/services/realtime/event-buffer')
}

describe('event-buffer strict real-time mode', () => {
  it('returns no live event when nothing was published', async () => {
    const buffer = await freshBuffer()
    expect(buffer.latestLiveVehicleEvent()).toBeUndefined()
  })

  it('ignores scheduled snapshots when looking for live data', async () => {
    const buffer = await freshBuffer()
    buffer.publishVehicleSnapshot(makeSnapshot('scheduled'), 'scheduled')
    expect(buffer.latestLiveVehicleEvent()).toBeUndefined()
  })

  it('returns the most recent live event while it is fresh', async () => {
    const buffer = await freshBuffer()
    buffer.publishVehicleSnapshot(makeSnapshot('live'), 'live')
    const second = buffer.publishVehicleSnapshot(makeSnapshot('live'), 'live')
    expect(buffer.latestLiveVehicleEvent()?.id).toBe(second.id)
  })

  it('prefers live data over a scheduled snapshot published afterwards', async () => {
    const buffer = await freshBuffer()
    const live = buffer.publishVehicleSnapshot(makeSnapshot('live'), 'live')
    buffer.publishVehicleSnapshot(makeSnapshot('scheduled'), 'scheduled')
    expect(buffer.latestLiveVehicleEvent()?.id).toBe(live.id)
  })

  it('treats live data as unavailable after LIVE_FRESH_MS of silence', async () => {
    const buffer = await freshBuffer()
    buffer.publishVehicleSnapshot(makeSnapshot('live'), 'live')
    const later = Date.now() + buffer.LIVE_FRESH_MS + 1
    expect(buffer.latestLiveVehicleEvent(later)).toBeUndefined()
  })
})
