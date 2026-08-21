import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  generateResetToken,
  hashResetToken,
  isResetRowUsable,
} from '~~/server/utils/admin-reset-token'
import {
  assertForgotAllowed,
  recordForgotRequest,
  resetForgotRateLimit,
} from '~~/server/utils/admin-forgot-limit'
import { forgotPasswordSchema, newPasswordSchema } from '~~/shared/schemas/admin-auth'
import { RESET_TOKEN_TTL_MS } from '~~/shared/types/admin-auth'

/**
 * Password-reset building blocks — pure functions only, no database.
 * createError is a Nitro auto-import, stubbed like in the other unit tests.
 */

vi.stubGlobal(
  'createError',
  (input: { statusCode: number, statusMessage?: string }) =>
    Object.assign(new Error(input.statusMessage), input),
)

describe('reset token helpers', () => {
  it('generates URL-safe, unique tokens', () => {
    const a = generateResetToken()
    const b = generateResetToken()

    expect(a).not.toBe(b)
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/) // base64url — safe in a query string
    expect(a.length).toBeGreaterThanOrEqual(40) // 32 bytes → ~43 chars
  })

  it('hashes deterministically and never echoes the raw token', () => {
    const token = generateResetToken()
    const hash = hashResetToken(token)

    expect(hashResetToken(token)).toBe(hash) // stable → DB lookup works
    expect(hash).toMatch(/^[a-f0-9]{64}$/) // sha256 hex
    expect(hash).not.toContain(token) // raw value never stored
  })

  it('accepts an unused, unexpired row', () => {
    const now = new Date('2026-07-26T12:00:00Z')
    const row = { usedAt: null, expiresAt: new Date(now.getTime() + 1000) }

    expect(isResetRowUsable(row, now)).toBe(true)
  })

  it('rejects a used row', () => {
    const now = new Date('2026-07-26T12:00:00Z')
    const row = { usedAt: now, expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS) }

    expect(isResetRowUsable(row, now)).toBe(false)
  })

  it('rejects a row after the 24h validity', () => {
    const created = new Date('2026-07-25T12:00:00Z')
    const expiresAt = new Date(created.getTime() + RESET_TOKEN_TTL_MS)
    const row = { usedAt: null, expiresAt }

    const justBefore = new Date(expiresAt.getTime() - 1)
    const exactlyAt = expiresAt

    expect(isResetRowUsable(row, justBefore)).toBe(true)
    expect(isResetRowUsable(row, exactlyAt)).toBe(false)
  })
})

describe('forgot-password rate limit (3 requests / 15 min per IP)', () => {
  const IP = '203.0.113.7'

  beforeEach(() => {
    vi.useFakeTimers()
    resetForgotRateLimit()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows a fresh IP', () => {
    expect(() => assertForgotAllowed(IP)).not.toThrow()
  })

  it('still allows the 3rd request, blocks the 4th with 429', () => {
    recordForgotRequest(IP)
    recordForgotRequest(IP)
    expect(() => assertForgotAllowed(IP)).not.toThrow() // 3rd request

    recordForgotRequest(IP)
    expect(() => assertForgotAllowed(IP)).toThrowError(
      expect.objectContaining({ statusCode: 429 }),
    )
  })

  it('rate limits per IP, not globally', () => {
    recordForgotRequest(IP)
    recordForgotRequest(IP)
    recordForgotRequest(IP)

    expect(() => assertForgotAllowed('198.51.100.1')).not.toThrow()
  })

  it('forgives after the 15-minute window expires', () => {
    recordForgotRequest(IP)
    recordForgotRequest(IP)
    recordForgotRequest(IP)
    vi.advanceTimersByTime(15 * 60 * 1000)

    expect(() => assertForgotAllowed(IP)).not.toThrow()
  })
})

describe('admin auth schemas', () => {
  it('rejects malformed email addresses', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'not-an-email' }).success).toBe(false)
    expect(forgotPasswordSchema.safeParse({ email: 'aminsab@outlook.fr' }).success).toBe(true)
  })

  it('enforces 12 characters minimum for the new password', () => {
    expect(newPasswordSchema.safeParse('short').success).toBe(false)
    expect(newPasswordSchema.safeParse('11-chars-pw').success).toBe(false)
    expect(newPasswordSchema.safeParse('a-long-passphrase').success).toBe(true)
  })
})
