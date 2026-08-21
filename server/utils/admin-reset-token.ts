import { createHash, randomBytes } from 'node:crypto'

/**
 * Password-reset token helpers — pure functions, unit-tested.
 *
 * The RAW token travels only inside the emailed link. The database keeps
 * its SHA-256 hash, so a leaked database can never be turned into a
 * working reset link.
 */

/** 32 random bytes, base64url — URL-safe, ~43 characters, unguessable. */
export function generateResetToken(): string {
  return randomBytes(32).toString('base64url')
}

/** SHA-256 hex of the raw token — the only form ever stored. */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** A token is usable while it is unused AND not expired. */
export function isResetRowUsable(
  row: { expiresAt: Date, usedAt: Date | null },
  now: Date = new Date(),
): boolean {
  return row.usedAt === null && row.expiresAt.getTime() > now.getTime()
}
