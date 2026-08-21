/**
 * Zod schemas for the public v1 WRITE endpoints (ROADMAP_NITRO_API Step 8).
 *
 * Read endpoints return frozen types (shared/types/api-v1.ts); these schemas
 * validate the bodies clients POST to us. Shared so the server handlers and
 * any future client-side form validation use the exact same rules.
 */
import { z } from 'zod'

/** POST /api/v1/devices — register a handset for push alerts (8.3). */
export const deviceRegistrationSchema = z.object({
  fcmToken: z.string().min(1, 'FCM token required').max(512),
  platform: z.enum(['android', 'ios']),
  favoriteLineIds: z.array(z.string().min(1).max(40)).max(100).default([]),
})

/** POST /api/v1/track — product analytics event (8.7). */
export const trackEventSchema = z.object({
  event: z.string().min(1, 'Event name required').max(80),
  platform: z.enum(['web', 'android', 'ios']),
  properties: z.record(z.union([z.string().max(200), z.number(), z.boolean()])).optional(),
})

export type DeviceRegistrationInput = z.infer<typeof deviceRegistrationSchema>
export type TrackEventInput = z.infer<typeof trackEventSchema>
