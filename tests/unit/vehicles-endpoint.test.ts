import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VehicleSnapshotInput } from '~~/shared/schemas/vehicle'

/**
 * Snapshot fallback priority for GET /api/vehicles (Phase 5).
 *
 * Strict real-time mode (see the header comment in vehicles.get.ts):
 *   1. live event-buffer snapshot — single source of truth when present
 *   2. GTFS schedule simulation  — ONLY when live data is unavailable
 *
 * Both services are mocked; the Zod response validation stays real.
 */

const mocks = vi.hoisted(() => ({
  latestLiveVehicleEvent: vi.fn(),
  getScheduledSnapshot: vi.fn(),
}))

vi.mock('~~/server/services/realtime/event-buffer', () => ({
  latestLiveVehicleEvent: mocks.latestLiveVehicleEvent,
}))
vi.mock('~~/server/services/simulation/scheduled-vehicles', () => ({
  getScheduledSnapshot: mocks.getScheduledSnapshot,
}))

// defineEventHandler is a Nitro auto-import; in this plain Node test we
// stub it as the identity function so the module can be imported directly.
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)

// The handler sets Cache-Control and may answer 304 via the ETag helper.
// Stub the h3 globals it touches; getHeader returns undefined (no
// If-None-Match) so sendNotModified always falls through to a 200 body.
vi.stubGlobal('setResponseHeader', vi.fn())
vi.stubGlobal('getHeader', vi.fn().mockReturnValue(undefined))

/** Minimal H3 event stand-in: only `node.res` is touched by the 304 path. */
const fakeEvent = {
  node: { res: { statusCode: 200, end: vi.fn() } },
} as never

function makeSnapshot(freshness: 'live' | 'stale'): VehicleSnapshotInput {
  return {
    freshness,
    recordedAt: new Date().toISOString(),
    vehicles: [],
  }
}

async function callHandler() {
  const handler = (await import('~~/server/api/vehicles.get'))
    .default as unknown as (event: never) => Promise<VehicleSnapshotInput>
  return handler(fakeEvent)
}

describe('GET /api/vehicles — snapshot fallback priority', () => {
  beforeEach(() => {
    mocks.latestLiveVehicleEvent.mockReset()
    mocks.getScheduledSnapshot.mockReset()
  })

  it('returns the live snapshot when the event buffer has one', async () => {
    const liveSnapshot = makeSnapshot('live')
    mocks.latestLiveVehicleEvent.mockReturnValue({ snapshot: liveSnapshot })

    const result = await callHandler()

    expect(result.freshness).toBe('live')
    expect(result.recordedAt).toBe(liveSnapshot.recordedAt)
    // Live and theoretical data are never mixed: the simulation must not run.
    expect(mocks.getScheduledSnapshot).not.toHaveBeenCalled()
  })

  it('falls back to the schedule simulation when live data is unavailable', async () => {
    const scheduledSnapshot = makeSnapshot('live')
    mocks.latestLiveVehicleEvent.mockReturnValue(null)
    mocks.getScheduledSnapshot.mockResolvedValue(scheduledSnapshot)

    const result = await callHandler()

    expect(result.recordedAt).toBe(scheduledSnapshot.recordedAt)
    expect(mocks.getScheduledSnapshot).toHaveBeenCalledTimes(1)
  })

  it('rejects a malformed snapshot instead of serving it', async () => {
    mocks.latestLiveVehicleEvent.mockReturnValue(null)
    mocks.getScheduledSnapshot.mockResolvedValue({ freshness: 'nope' })

    await expect(callHandler()).rejects.toThrow()
  })
})
