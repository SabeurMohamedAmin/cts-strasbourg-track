/**
 * Nitro server plugin — periodic disruption push sweep
 * (ROADMAP_NITRO_API 8.4).
 *
 * Admin CRUD writes a disruption row; this sweep notices rows with
 * `pushed_at IS NULL` and fans the notification out. Polling instead of
 * calling the sender inline from the admin handler keeps the admin request
 * fast and means a push is never lost when the fan-out fails midway.
 *
 * No-ops without a database or without the NUXT_FCM_* credentials, so local
 * development and builds are unaffected.
 */

import { isPushConfigured } from '../services/push/fcm-client'
import { pushPendingDisruptions } from '../services/push/disruption-push'

/** A minute is soon enough for a disruption banner, and cheap on the DB. */
const SWEEP_INTERVAL_MS = 60_000

export default defineNitroPlugin(() => {
  if (!process.env.NUXT_DATABASE_URL) return

  if (!isPushConfigured()) {
    console.info('[disruption-push] NUXT_FCM_* not set — push notifications disabled.')
    return
  }

  // Fire-and-forget on boot, then every minute.
  void pushPendingDisruptions()
  setInterval(() => { void pushPendingDisruptions() }, SWEEP_INTERVAL_MS).unref?.()
})
