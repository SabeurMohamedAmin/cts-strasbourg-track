import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assertLoginAllowed,
  clearLoginAttempts,
  recordFailedLogin,
  resetLoginRateLimit,
} from '~~/server/utils/admin-login-limit'

/**
 * server/utils/admin-login-limit.ts — 5 failed attempts / 15 min per IP.
 * createError is a Nitro auto-import, stubbed like in the other unit tests.
 */

vi.stubGlobal(
  'createError',
  (input: { statusCode: number, statusMessage?: string }) =>
    Object.assign(new Error(input.statusMessage), input),
)

const IP = '203.0.113.7'

function failTimes(count: number) {
  for (let i = 0; i < count; i++) recordFailedLogin(IP)
}

describe('admin login rate limit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetLoginRateLimit()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows a fresh IP', () => {
    expect(() => assertLoginAllowed(IP)).not.toThrow()
  })

  it('still allows the 5th attempt, blocks the 6th with 429', () => {
    failTimes(4)
    expect(() => assertLoginAllowed(IP)).not.toThrow() // 5th try

    recordFailedLogin(IP) // 5th failure
    expect(() => assertLoginAllowed(IP)).toThrowError(
      expect.objectContaining({ statusCode: 429 }),
    )
  })

  it('rate limits per IP, not globally', () => {
    failTimes(5)
    expect(() => assertLoginAllowed('198.51.100.1')).not.toThrow()
  })

  it('forgives after the 15-minute window expires', () => {
    failTimes(5)
    vi.advanceTimersByTime(15 * 60 * 1000)

    expect(() => assertLoginAllowed(IP)).not.toThrow()
  })

  it('clears the counter after a successful login', () => {
    failTimes(5)
    clearLoginAttempts(IP)

    expect(() => assertLoginAllowed(IP)).not.toThrow()
  })
})
