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
