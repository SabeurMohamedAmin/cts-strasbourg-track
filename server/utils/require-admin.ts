import type { H3Event } from 'h3'

/**
 * Guard for every /api/admin/** handler — call it FIRST, before touching
 * the database or the request body:
 *
 *   export default defineEventHandler(async (event) => {
 *     await requireAdmin(event)
 *     // …admin-only logic
 *   })
 *
 * Thin wrapper around nuxt-auth-utils' requireUserSession (which already
 * throws 401 when no session cookie is present) that additionally checks
 * the role, so a future non-admin session can never reach admin endpoints.
 */
export async function requireAdmin(event: H3Event): Promise<void> {
  const { user } = await requireUserSession(event)

  if (user?.role !== 'admin') {
    throw createError({ statusCode: 401, statusMessage: 'Administrator session required' })
  }
}
