/**
 * POST /api/admin/logout — destroys the admin session cookie.
 *
 * Always answers { ok: true }: logging out an already-anonymous visitor
 * is a no-op, not an error.
 */
export default defineEventHandler(async (event) => {
  await clearUserSession(event)
  return { ok: true }
})
