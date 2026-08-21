/**
 * Nitro server plugin — daily prune of stale device registrations
 * (ROADMAP_NITRO_API 9.7).
 *
 * FCM tokens rotate (app reinstall, restore, Play Services refresh), so rows
 * whose `updated_at` has not been refreshed in STALE_AFTER_MS are dead: the
 * push sender (8.4) would only collect delivery errors for them, and the
 * table would grow without bound under registration spam.
 *
 * Same defensive pattern as db-check.ts: dynamic db import, never blocks
 * boot, interval unref'd so it cannot keep the process alive.
 */

import { lt } from 'drizzle-orm'
import { devices } from '../database/schema/devices'

/** Prune once a day — staleness is measured in months, not minutes. */
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1_000
/** A healthy install re-registers on every app start; 180 days is dead. */
const STALE_AFTER_MS = 180 * 24 * 60 * 60 * 1_000

async function pruneStaleDevices(): Promise<void> {
  try {
    const { db } = await import('../database')
    const cutoff = new Date(Date.now() - STALE_AFTER_MS)
    const removed = await db
      .delete(devices)
      .where(lt(devices.updatedAt, cutoff))
      .returning({ id: devices.id })

    if (removed.length) {
      console.info(`[devices-cleanup] Pruned ${removed.length} stale device registration(s).`)
    }
  }
  catch (error) {
    // Best-effort maintenance: never let cleanup take the server down.
    console.error('[devices-cleanup] Prune failed', error)
  }
}

export default defineNitroPlugin(() => {
  if (!process.env.NUXT_DATABASE_URL) return

  // Fire-and-forget on boot, then daily.
  void pruneStaleDevices()
  setInterval(() => { void pruneStaleDevices() }, SWEEP_INTERVAL_MS).unref?.()
})
