import { pgTable, serial, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'

/**
 * Service disruptions (ROADMAP_NITRO_API 8.2).
 *
 * One row per disruption, managed from the admin shell (ADMIN roadmap
 * Phase 11) and served read-only at GET /api/v1/disruptions.
 *
 * `lineIds` / `stopIds` are JSON arrays of GTFS ids; empty arrays mean
 * "network-wide" / "no specific stop" respectively, so a single row can
 * describe anything from one blocked platform to a full network strike.
 */
export const disruptions = pgTable('disruptions', {
  id:          serial('id').primaryKey(),
  title:       text('title').notNull(),
  description: text('description').notNull(),
  /** 'info' | 'warning' | 'critical' — drives the client badge colour. */
  severity:    text('severity', { enum: ['info', 'warning', 'critical'] }).notNull().default('info'),
  /** GTFS route ids affected; [] = every line. */
  lineIds:     jsonb('line_ids').$type<string[]>().notNull().default([]),
  /** GTFS stop ids affected; [] = no specific stop. */
  stopIds:     jsonb('stop_ids').$type<string[]>().notNull().default([]),
  startsAt:    timestamp('starts_at').notNull(),
  /** NULL = open-ended (until further notice). */
  endsAt:      timestamp('ends_at'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  /**
   * When the push notification was sent (ROADMAP_NITRO_API 8.4).
   * NULL = never announced yet, so the push sweep will pick it up.
   */
  pushedAt:    timestamp('pushed_at'),
}, (t) => ([
  index('disruptions_starts_at_idx').on(t.startsAt),
  index('disruptions_pushed_at_idx').on(t.pushedAt),
]))

export type DisruptionRow = typeof disruptions.$inferSelect
