import { pgTable, serial, text, timestamp, jsonb, uniqueIndex } from 'drizzle-orm/pg-core'

/**
 * Registered mobile devices (ROADMAP_NITRO_API 8.3).
 *
 * One row per handset, keyed by its FCM token. The row records the platform
 * and the favourite line ids the device wants disruption push alerts for.
 * The server-side FCM sender (8.4) reads this table; the key lives in
 * runtimeConfig and never reaches a client.
 */
export const devices = pgTable('devices', {
  id:              serial('id').primaryKey(),
  /** Firebase Cloud Messaging registration token — unique per install. */
  fcmToken:        text('fcm_token').notNull(),
  /** 'android' | 'ios'. */
  platform:        text('platform', { enum: ['android', 'ios'] }).notNull(),
  /** Favourite GTFS route ids for targeted push alerts. */
  favoriteLineIds: jsonb('favorite_line_ids').$type<string[]>().notNull().default([]),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
  /** Re-registration refreshes this so stale tokens can be pruned. */
  updatedAt:       timestamp('updated_at').notNull().defaultNow(),
}, (t) => ([
  uniqueIndex('devices_fcm_token_idx').on(t.fcmToken),
]))

export type DeviceRow = typeof devices.$inferSelect
