/**
 * Admin password-reset constants.
 *
 * SERVER-SIDE ONLY: never import ADMIN_RESET_EMAILS from app/** code —
 * the allowlist must not ship in a client bundle. The client never needs
 * it anyway: the forgot-password endpoint answers with the same generic
 * message whether an address is allowlisted or not.
 */

/** The only addresses a reset link may be sent to. */
export const ADMIN_RESET_EMAILS = [
  'aminsab@outlook.fr',
  'sabeurmohammedamin@gmail.com',
] as const

/** A reset link stays valid for 24 hours. */
export const RESET_TOKEN_TTL_MS = 24 * 60 * 60 * 1000
