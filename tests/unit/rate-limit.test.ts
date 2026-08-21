import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assertWithinRateLimit, resetRateLimit } from '~~/server/utils/rate-limit'

/**
 * server/utils/rate-limit.ts — fixed-window limit on the public v1 surface.
 * createError is a Nitro auto-import, stubbed like in the other unit tests.
 */

vi.stubGlobal(
  'createError',
  (input: { statusCode: number, statusMessage?: string }) =>
    Object.assign(new Error(input.statusMessage), input),
)

describe('public API rate limit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetRateLimit()
  })

  it('allows normal app usage well under the cap', () => {
    expect(() => {
      for (let i = 0; i < 120; i++) assertWithinRateLimit('ip:203.0.113.7')
    }).not.toThrow()
  })

  it('blocks the request past the cap with 429', () => {
    for (let i = 0; i < 120; i++) assertWithinRateLimit('ip:203.0.113.7')
    expect(() => assertWithinRateLimit('ip:203.0.113.7')).toThrowError(
      expect.objectContaining({ statusCode: 429 }),
    )
  })

  it('limits per key, not globally', () => {
    for (let i = 0; i < 120; i++) assertWithinRateLimit('ip:203.0.113.7')
    expect(() => assertWithinRateLimit('token:abc')).not.toThrow()
  })

  it('resets after the window expires', () => {
    for (let i = 0; i < 120; i++) assertWithinRateLimit('ip:203.0.113.7')
    vi.advanceTimersByTime(61_000)
    expect(() => assertWithinRateLimit('ip:203.0.113.7')).not.toThrow()
  })
})

/**
 * 9.7 — POST /api/v1/devices layers a stricter dedicated bucket
 * (10 registrations per hour, per IP) on top of the global limit.
 */
describe('dedicated stricter bucket', () => {
  const CAP = 10
  const HOUR_MS = 3_600_000
  const key = 'devices:ip:203.0.113.7'

  beforeEach(() => {
    vi.useFakeTimers()
    resetRateLimit()
  })

  it('allows the allowance and blocks the next request', () => {
    for (let i = 0; i < CAP; i++) assertWithinRateLimit(key, CAP, HOUR_MS)
    expect(() => assertWithinRateLimit(key, CAP, HOUR_MS)).toThrowError(
      expect.objectContaining({ statusCode: 429 }),
    )
  })

  it('honours the custom window instead of the global one', () => {
    for (let i = 0; i < CAP; i++) assertWithinRateLimit(key, CAP, HOUR_MS)

    // Still limited after the 1-minute global window has passed.
    vi.advanceTimersByTime(61_000)
    expect(() => assertWithinRateLimit(key, CAP, HOUR_MS)).toThrowError(
      expect.objectContaining({ statusCode: 429 }),
    )

    // Free again once the hour is over.
    vi.advanceTimersByTime(HOUR_MS)
    expect(() => assertWithinRateLimit(key, CAP, HOUR_MS)).not.toThrow()
  })

  it('does not consume the global bucket for the same IP', () => {
    for (let i = 0; i < CAP; i++) assertWithinRateLimit(key, CAP, HOUR_MS)
    // The middleware key is prefixed differently, so reads stay unaffected.
    expect(() => assertWithinRateLimit('ip:203.0.113.7')).not.toThrow()
  })
})
