import { pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

/**
 * Admin authentication — v1 is a single admin account.
 *
 *   admin_credentials      — exactly ONE row: username + scrypt password
 *                            hash (hashPassword() from nuxt-auth-utils).
 *                            The NUXT_ADMIN_PASSWORD env var is only a
 *                            bootstrap fallback: the first successful
 *                            env-based login writes this row, and every
 *                            later login checks the row, not the env.
 *
 *   admin_password_resets  — one row per "forgot password" request.
 *                            We store the SHA-256 HASH of the token, never
 *                            the raw token (a DB leak must not allow a
 *                            reset). Tokens are single-use (usedAt) and
 *                            expire after 24 hours (expiresAt).
 */

/** The single admin account. Password is a scrypt hash, never plaintext. */
export const adminCredentials = pgTable('admin_credentials', {
  id:           serial('id').primaryKey(),
  username:     text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
}, (t) => ([
  uniqueIndex('admin_credentials_username_idx').on(t.username),
]))

/** One password-reset token (hashed). Single-use, 24h validity. */
export const adminPasswordResets = pgTable('admin_password_resets', {
  id:        serial('id').primaryKey(),
  /** SHA-256 hex of the raw token sent by email — the raw value is never stored. */
  tokenHash: text('token_hash').notNull(),
  /** Allowlisted address the reset link was sent to (audit trail). */
  email:     text('email').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  /** Set when the token is consumed — a used token can never be replayed. */
  usedAt:    timestamp('used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ([
  uniqueIndex('admin_password_resets_token_hash_idx').on(t.tokenHash),
]))

export type AdminCredentialsRow = typeof adminCredentials.$inferSelect
export type AdminPasswordResetRow = typeof adminPasswordResets.$inferSelect
