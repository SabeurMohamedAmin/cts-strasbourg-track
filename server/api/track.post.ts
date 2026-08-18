/**
 * POST /api/v1/track (ROADMAP_NITRO_API 8.7).
 *
 * Accepts a product analytics event from any client (web, android, ios).
 * v1 keeps this deliberately minimal: the event is validated and logged for
 * the host's log drain, not persisted to the database. A later iteration can
 * forward to an analytics backend without changing the client contract.
 *
 * Always answers 202 Accepted: analytics must never block or error the app.
 */
import { trackEventSchema } from '~~/shared/schemas/api-v1'
import type { TrackAccepted } from '~~/shared/types/api-v1'

export default defineEventHandler(async (event): Promise<TrackAccepted> => {
  const body = await readValidatedBody(event, trackEventSchema.parse)

  // No PII: only the event name, platform and small property bag are logged.
  console.info(`[track] ${body.platform} ${body.event}`, body.properties ?? {})

  setResponseStatus(event, 202)
  return { ok: true }
})
