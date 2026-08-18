/**
 * Lightweight per-IP/token rate limit for the PUBLIC v1 endpoints
 * (ROADMAP_NITRO_API 3.5).
 *
 * Goal: protect the CTS quota and the database behind our cache from a
 * runaway or abusive client, without penalising normal app usage.
 *
 * Design notes:
 *   - In-memory fixed-window counter, same trade-off as admin-login-limit.ts:
 *     a single Nitro instance, a restart simply resets the counters.
 *   - Keyed by the app token when present, else by IP — a token identifies
 *     one installed app, an IP can be shared (carrier-grade NAT).
 *   - Fails OPEN on internal errors: a limiter bug must never take the
 *     public API down.
 *
 * The SSE stream and the cheap static endpoints are exempt (see the
 * middleware) — long-lived connections and cacheable reads are not the
 * abuse vector.
 */

const WINDOW_MS = 60_000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 120 // generous: a polling app stays well under

interface Window {
  count: number
  resetAt: number
}

const buckets = new Map<string, Window>()

/** Throws 429 when the key exceeded its allowance for the current window. */
export function assertWithinRateLimit(key: string): void {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return
  }

  bucket.count += 1
  if (bucket.count > MAX_REQUESTS_PER_WINDOW) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      data: { statusCode: 429, code: 'rate_limited', message: 'Too many requests' },
    })
  }
}

/** Periodically drop expired windows so the map does not grow unbounded. */
function sweep(): void {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key)
  }
}

// Best-effort cleanup; unref so it never keeps a process alive.
if (typeof setInterval !== 'undefined') {
  setInterval(sweep, WINDOW_MS).unref?.()
}

/** Test helper: wipe every counter (never called by production code). */
export function resetRateLimit(): void {
  buckets.clear()
}
