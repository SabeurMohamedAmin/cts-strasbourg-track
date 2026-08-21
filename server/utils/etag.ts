/**
 * ETag / conditional-GET helper (ROADMAP_NITRO_API 5.2).
 *
 * Lets Flutter (and the browser) revalidate a payload cheaply: the server
 * answers 304 Not Modified when the client's cached copy is still current,
 * saving bandwidth on the mobile network.
 *
 * Usage in a handler:
 *
 *   const body = buildPayload()
 *   if (sendNotModified(event, body)) return   // 304 already sent
 *   return body                                 // 200 + ETag header set
 *
 * The tag is a SHA-256 of the JSON body — strong, deterministic, and cheap
 * enough for the small JSON payloads this API serves.
 */
import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'

/** Compute a strong ETag for a JSON-serialisable body. */
export function computeEtag(body: unknown): string {
  const hash = createHash('sha256').update(JSON.stringify(body)).digest('hex')
  return `"${hash}"`
}

/**
 * Set the ETag header and, when the client's If-None-Match matches, send a
 * 304 and return true (the handler should then return without a body).
 */
export function sendNotModified(event: H3Event, body: unknown): boolean {
  const etag = computeEtag(body)
  setResponseHeader(event, 'ETag', etag)

  const ifNoneMatch = getHeader(event, 'if-none-match')
  if (ifNoneMatch && ifNoneMatch === etag) {
    event.node.res.statusCode = 304
    event.node.res.end()
    return true
  }
  return false
}
