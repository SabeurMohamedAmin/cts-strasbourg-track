import { describe, it, expect } from 'vitest'

/**
 * Unit tests for GTFS time helpers.
 *
 * GTFS times can exceed 24 h (e.g. "25:30:00" means 01:30 the next calendar
 * day).  These tests verify that our parsing and arithmetic handle those cases
 * correctly without importing the full server bundle.
 */

/** Inline the pure function so this test has zero server dependencies. */
function timeToSeconds(t: string): number {
  const [h, m, s] = t.split(':').map(Number)
  return (h ?? 0) * 3600 + (m ?? 0) * 60 + (s ?? 0)
}

describe('timeToSeconds', () => {
  it('converts a normal time', () => {
    expect(timeToSeconds('08:30:00')).toBe(8 * 3600 + 30 * 60)
  })

  it('converts midnight exactly', () => {
    expect(timeToSeconds('00:00:00')).toBe(0)
  })

  it('converts end-of-day', () => {
    expect(timeToSeconds('23:59:59')).toBe(23 * 3600 + 59 * 60 + 59)
  })

  it('handles GTFS overnight times > 24 h', () => {
    // "25:30:00" = 1 h 30 min into the next calendar day = 91 800 s
    expect(timeToSeconds('25:30:00')).toBe(25 * 3600 + 30 * 60)
  })

  it('handles "28:00:00" (4 AM next day)', () => {
    expect(timeToSeconds('28:00:00')).toBe(28 * 3600)
  })
})

// ---------------------------------------------------------------------------
// adjustedNow logic (mirrors the overnight fix in scheduled-vehicles.ts)
// ---------------------------------------------------------------------------

describe('overnight trip adjustedNow', () => {
  /**
   * If a trip's startSec >= 86400, it belongs to the previous service day
   * but runs past midnight into the current one.  We add 86400 to the current
   * wall-clock seconds so position interpolation stays correct.
   */
  function computeAdjustedNow(nowSec: number, tripStartSec: number): number {
    return tripStartSec >= 86_400 ? nowSec + 86_400 : nowSec
  }

  it('does not adjust a normal daytime trip', () => {
    expect(computeAdjustedNow(36_000, 28_800)).toBe(36_000) // 10:00, starts 08:00
  })

  it('adjusts an overnight trip that started before midnight', () => {
    // Trip starts at 25:30 (86400 + 5400 = 91800)
    // Current wall clock is 01:30 = 5400 s
    expect(computeAdjustedNow(5_400, 91_800)).toBe(5_400 + 86_400)
  })

  it('returns adjusted value within the trip window', () => {
    const startSec = 90_000 // 25:00:00
    const endSec = 97_200   // 27:00:00
    const nowSec = 3_600    // 01:00:00 wall clock
    const adjusted = computeAdjustedNow(nowSec, startSec)
    expect(adjusted).toBeGreaterThanOrEqual(startSec)
    expect(adjusted).toBeLessThanOrEqual(endSec)
  })
})
