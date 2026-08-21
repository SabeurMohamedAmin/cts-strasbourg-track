import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * server/utils/require-admin.ts — the guard every /api/admin/** handler
 * calls first.
 *
 * requireUserSession and createError are Nitro auto-imports (globals at
 * runtime); in this plain Node test they are stubbed, following the same
 * pattern as vehicles-endpoint.test.ts.
 */

const mocks = vi.hoisted(() => ({
  requireUserSession: vi.fn(),
}))

vi.stubGlobal('requireUserSession', mocks.requireUserSession)
vi.stubGlobal(
  'createError',
  (input: { statusCode: number, statusMessage?: string }) =>
    Object.assign(new Error(input.statusMessage), input),
)

const fakeEvent = {} as never

async function callGuard() {
  const { requireAdmin } = await import('~~/server/utils/require-admin')
  return requireAdmin(fakeEvent)
}

describe('requireAdmin', () => {
  beforeEach(() => {
    mocks.requireUserSession.mockReset()
  })

  it('passes when the session user has the admin role', async () => {
    mocks.requireUserSession.mockResolvedValue({ user: { role: 'admin' } })

    await expect(callGuard()).resolves.toBeUndefined()
  })

  it('throws 401 when the session exists but has no admin role', async () => {
    mocks.requireUserSession.mockResolvedValue({ user: undefined })

    await expect(callGuard()).rejects.toMatchObject({ statusCode: 401 })
  })

  it('propagates the 401 thrown by requireUserSession (no cookie)', async () => {
    mocks.requireUserSession.mockRejectedValue(
      Object.assign(new Error('Unauthorized'), { statusCode: 401 }),
    )

    await expect(callGuard()).rejects.toMatchObject({ statusCode: 401 })
  })
})
