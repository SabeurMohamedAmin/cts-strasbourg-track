import { db } from '~~/server/database'
import { adminPasswordResets } from '~~/server/database/schema/admin'
import { forgotPasswordSchema } from '~~/shared/schemas/admin-auth'
import { ADMIN_RESET_EMAILS, RESET_TOKEN_TTL_MS } from '~~/shared/types/admin-auth'
import { assertForgotAllowed, recordForgotRequest } from '../../../utils/admin-forgot-limit'
import { generateResetToken, hashResetToken } from '../../../utils/admin-reset-token'
import { sendAdminPasswordResetEmail } from '../../../utils/mailer'
import { resolveSiteUrl } from '../../../utils/site-url'

/**
 * POST /api/admin/password/forgot — body: { email }.
 *
 * Anti-enumeration rule: the answer is ALWAYS the same generic 200,
 * whether the address is allowlisted or not, and even when the email
 * provider fails. An attacker learns nothing from this endpoint.
 *
 * Rate-limited: 3 requests / 15 min per IP (every request counts).
 */
export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  assertForgotAllowed(ip) // throws 429 when the window is exhausted
  recordForgotRequest(ip)

  const { email } = await readValidatedBody(event, forgotPasswordSchema.parse)

  const genericAnswer = {
    ok: true,
    message: 'Si cette adresse est autorisée, un e-mail de réinitialisation a été envoyé.',
  }

  // Silent rejection: non-allowlisted addresses get the same answer.
  if (!(ADMIN_RESET_EMAILS as readonly string[]).includes(email)) {
    return genericAnswer
  }

  const token = generateResetToken()
  await db.insert(adminPasswordResets).values({
    tokenHash: hashResetToken(token),
    email,
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  })

  const resetUrl = `${resolveSiteUrl(event)}/admin/reset-password?token=${token}`

  try {
    await sendAdminPasswordResetEmail(event, email, resetUrl)
  }
  catch (error) {
    // Log for the operator, but never leak mailer state to the caller.
    console.error('[admin] password reset email failed:', error)
  }

  return genericAnswer
})
