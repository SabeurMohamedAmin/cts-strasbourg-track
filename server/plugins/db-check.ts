/**
 * Nitro server plugin — one-time database connectivity check on boot.
 *
 * Fails fast with a single actionable error message when the database is
 * unreachable, instead of letting every API route and poller cycle surface
 * the same low-level driver error. The server keeps running: GTFS endpoints
 * return errors and the poller degrades gracefully until the database is
 * reachable again.
 */

import { sql } from 'drizzle-orm'

/** Total connection attempts before the database is reported unreachable. */
const MAX_ATTEMPTS = 3
/** Pause between attempts. */
const RETRY_DELAY_MS = 2_000

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function checkDatabaseConnection(): Promise<void> {
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      // Dynamic import so this plugin is safe even when the database module
      // throws at import time (e.g. during builds without NUXT_DATABASE_URL).
      const { db } = await import('../database')
      await db.execute(sql`select 1`)
      console.info('[db-check] Database connection OK.')
      return
    }
    catch (err) {
      // Transient failures are common on the first attempt: Supabase's
      // Supavisor pooler can reject the initial auth while its cache warms
      // up after a cold start. Retry quietly before raising the alarm.
      lastError = err
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS)
    }
  }

  // Surface the root cause (e.g. ENOTFOUND) rather than the Drizzle wrapper.
  const cause = lastError instanceof Error && lastError.cause instanceof Error
    ? lastError.cause
    : lastError
  const reason = cause instanceof Error ? cause.message : String(cause)

  console.error(
    `[db-check] Cannot reach the database: ${reason}\n`
    + '  1. Check that NUXT_DATABASE_URL in .env points to a reachable host.\n'
    + '  2. ENOTFOUND on a "db.<ref>.supabase.co" host usually means your network\n'
    + '     has no IPv6 — use the Session pooler connection string instead\n'
    + '     (Supabase Dashboard > Connect > Session pooler, port 5432).\n'
    + '  3. Free-tier Supabase projects pause after inactivity — restore the\n'
    + '     project from the Supabase dashboard.',
  )
}

export default defineNitroPlugin(() => {
  if (!process.env.NUXT_DATABASE_URL) {
    console.warn(
      '[db-check] NUXT_DATABASE_URL is not set — '
      + 'GTFS endpoints and coordinate enrichment are disabled.',
    )
    return
  }

  // Fire-and-forget: the check must never delay or block server boot.
  void checkDatabaseConnection()
})
