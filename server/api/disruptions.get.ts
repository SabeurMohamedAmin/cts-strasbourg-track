/**
 * GET /api/v1/disruptions (ROADMAP_NITRO_API 8.2).
 *
 * Public, read-only list of CURRENT and UPCOMING service disruptions,
 * managed from the admin shell. A disruption is returned when its window
 * overlaps "now": it has started (starts_at <= now) and is either
 * open-ended (ends_at IS NULL) or not yet finished (ends_at >= now).
 *
 * Ordered by severity (critical first) then start time so the most urgent
 * banner leads the client UI.
 */
import { and, asc, desc, gte, isNull, lte, or } from 'drizzle-orm'
import { db } from '~~/server/database'
import { disruptions } from '~~/server/database/schema/disruptions'
import { sendNotModified } from '../utils/etag'
import type { Disruption } from '~~/shared/types/api-v1'

export default defineEventHandler(async (event): Promise<Disruption[] | undefined> => {
  const now = new Date()

  const rows = await db
    .select()
    .from(disruptions)
    .where(and(
      lte(disruptions.startsAt, now),
      or(isNull(disruptions.endsAt), gte(disruptions.endsAt, now)),
    ))
    .orderBy(desc(disruptions.severity), asc(disruptions.startsAt))

  const body: Disruption[] = rows.map(row => ({
    id: row.id,
    title: row.title,
    description: row.description,
    severity: row.severity,
    lineIds: row.lineIds,
    stopIds: row.stopIds,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
  }))

  // Disruptions change rarely: cache briefly and let clients revalidate.
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  if (sendNotModified(event, body)) return undefined
  return body
})
