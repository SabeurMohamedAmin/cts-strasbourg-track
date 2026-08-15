import { eq } from 'drizzle-orm'
import { db } from '~~/server/database'
import { adminCredentials, adminPasswordResets } from '~~/server/database/schema/admin'
import { resetPasswordSchema } from '~~/shared/schemas/admin-auth'
import { hashResetToken, isResetRowUsable } from '../../../utils/admin-reset-token'

/**
 * POST /api/admin/password/reset — body: { token, newPassword }.
 *
 * The token must exist (by hash), be unused, and not be expired (24h).
 * On success, inside one transaction:
 *   1. the admin_credentials row gets the new scrypt hash (created if
 *      the table is still empty — e.g. reset before any first login),
 *   2. the token is marked used so it can never be replayed.
 * The current session cookie is then cleared: after a reset, everyone
 * logs in again with the new password.
 *
 * Note (v1): sealed cookies on OTHER devices cannot be revoked without a
 * server-side session store — they simply age out with the cookie.
 */
export default defineEventHandler(async (event) => {
  const { token, newPassword } = await readValidatedBody(event, resetPasswordSchema.parse)

  const [row] = await db
    .select()
    .from(adminPasswordResets)
    .where(eq(adminPasswordResets.tokenHash, hashResetToken(token)))
    .limit(1)

  if (!row || !isResetRowUsable(row)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid or expired reset link' })
  }

  // scrypt hash via nuxt-auth-utils — same helper the login check uses.
  const passwordHash = await hashPassword(newPassword)
  const username = useRuntimeConfig(event).adminUsername

  await db.transaction(async (tx) => {
    const [credentials] = await tx.select().from(adminCredentials).limit(1)

    if (credentials) {
      await tx
        .update(adminCredentials)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(adminCredentials.id, credentials.id))
    }
    else {
      await tx.insert(adminCredentials).values({ username, passwordHash })
    }

    await tx
      .update(adminPasswordResets)
      .set({ usedAt: new Date() })
      .where(eq(adminPasswordResets.id, row.id))
  })

  await clearUserSession(event)

  return { ok: true }
})
