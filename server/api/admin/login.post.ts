import { createHash, timingSafeEqual } from 'node:crypto'
import { db } from '~~/server/database'
import { adminCredentials } from '~~/server/database/schema/admin'
import { adminLoginSchema } from '~~/shared/schemas/admin-auth'
import {
  assertLoginAllowed,
  clearLoginAttempts,
  recordFailedLogin,
} from '../../utils/admin-login-limit'

/**
 * POST /api/admin/login — opens the single-admin session (v1).
 *
 * Credentials live in the admin_credentials table (scrypt hash via
 * nuxt-auth-utils). The NUXT_ADMIN_USERNAME / NUXT_ADMIN_PASSWORD env
 * vars are only the BOOTSTRAP: while the table is empty, they are
 * checked directly, and the first successful login persists them
 * (hashed) so later logins — and password resets — use the database.
 *
 * - Rate-limited: 5 failed attempts / 15 min per IP (admin-login-limit).
 * - Constant-time compares: values are hashed to a fixed length first,
 *   so timingSafeEqual never leaks length information.
 * - On success, nuxt-auth-utils seals { user: { role: 'admin' } } into
 *   the session cookie (secret: NUXT_SESSION_PASSWORD).
 */

/** Compares two secrets without leaking timing or length information. */
function secretsMatch(candidate: string, expected: string): boolean {
  const candidateHash = createHash('sha256').update(candidate).digest()
  const expectedHash = createHash('sha256').update(expected).digest()
  return timingSafeEqual(candidateHash, expectedHash)
}

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  assertLoginAllowed(ip) // throws 429 when the window is exhausted

  const { username, password } = await readValidatedBody(event, adminLoginSchema.parse)

  const [credentials] = await db.select().from(adminCredentials).limit(1)

  if (credentials) {
    // Normal path: check against the database row.
    const usernameOk = secretsMatch(username, credentials.username)
    const passwordOk = await verifyPassword(credentials.passwordHash, password)

    if (!usernameOk || !passwordOk) {
      recordFailedLogin(ip)
      throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
    }
  }
  else {
    // Bootstrap path: the table is empty — check the env vars.
    const config = useRuntimeConfig(event)
    if (!config.adminPassword) {
      // Deployment error, not a user error: NUXT_ADMIN_PASSWORD is missing.
      throw createError({ statusCode: 500, statusMessage: 'Admin password is not configured' })
    }

    const usernameOk = secretsMatch(username, config.adminUsername)
    const passwordOk = secretsMatch(password, config.adminPassword)

    if (!usernameOk || !passwordOk) {
      recordFailedLogin(ip)
      throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
    }

    // Persist the account: from now on the database is the source of
    // truth, and "reset password" can overwrite the hash.
    await db.insert(adminCredentials).values({
      username: config.adminUsername,
      passwordHash: await hashPassword(password),
    })
  }

  clearLoginAttempts(ip)
  await setUserSession(event, { user: { role: 'admin' } })

  return { ok: true }
})
