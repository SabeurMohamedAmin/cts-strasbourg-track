/**
 * POST /api/v1/devices (ROADMAP_NITRO_API 8.3).
 *
 * Registers a handset for disruption push alerts. Idempotent: the FCM token
 * is unique, so re-registering the same install simply refreshes its
 * platform, favourite lines and `updated_at` (upsert on conflict).
 *
 * The FCM token is a device identifier, never logged. The server-side FCM
 * sender (8.4) reads this table; its key lives in runtimeConfig.
 */
import { db } from '~~/server/database'
import { devices } from '~~/server/database/schema/devices'
import { assertWithinRateLimit } from '~~/server/utils/rate-limit'
import { deviceRegistrationSchema } from '~~/shared/schemas/api-v1'
import type { DeviceRegistered } from '~~/shared/types/api-v1'

/**
 * 9.7: a handset registers once plus occasional favourite updates, so
 * 10/hour per IP blocks spam floods without touching legitimate traffic
 * (carrier-grade NAT still fits: registration is a rare event).
 */
const REGISTRATIONS_PER_HOUR = 10
const HOUR_MS = 3_600_000

export default defineEventHandler(async (event): Promise<DeviceRegistered> => {
  // Stricter dedicated bucket on top of the global /api/v1 limit (9.7):
  // this is an unauthenticated write, the cheapest thing to abuse.
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  assertWithinRateLimit(`devices:ip:${ip}`, REGISTRATIONS_PER_HOUR, HOUR_MS)

  const body = await readValidatedBody(event, deviceRegistrationSchema.parse)

  const [row] = await db
    .insert(devices)
    .values({
      fcmToken: body.fcmToken,
      platform: body.platform,
      favoriteLineIds: body.favoriteLineIds,
    })
    .onConflictDoUpdate({
      target: devices.fcmToken,
      set: {
        platform: body.platform,
        favoriteLineIds: body.favoriteLineIds,
        updatedAt: new Date(),
      },
    })
    .returning({ id: devices.id })

  setResponseStatus(event, 201)
  return { id: row!.id, ok: true }
})
