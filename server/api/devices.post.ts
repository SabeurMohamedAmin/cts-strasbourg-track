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
import { deviceRegistrationSchema } from '~~/shared/schemas/api-v1'
import type { DeviceRegistered } from '~~/shared/types/api-v1'

export default defineEventHandler(async (event): Promise<DeviceRegistered> => {
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
