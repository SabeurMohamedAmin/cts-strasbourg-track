/**
 * Public API security middleware (ROADMAP_NITRO_API Step 3).
 *
 * Runs on every /api/* request and layers four controls:
 *
 *   3.3  App token      — when NUXT_APP_TOKEN is set, /api/v1/* requests must
 *                         carry a matching `X-App-Token` header. This is a
 *                         lightweight "is this our app?" check, NOT auth.
 *                         Web (same-origin browser) traffic is exempt so the
 *                         PWA keeps working without embedding the secret.
 *   3.4  Strict CORS    — the web app is same-origin and mobile needs no
 *                         CORS, so we never emit a wildcard `*`. We only
 *                         reflect an Origin that matches the configured site.
 *   3.5  Rate limiting  — per token/IP fixed window on the public surface.
 *   3.6  HSTS           — Strict-Transport-Security on API responses.
 *
 * Admin endpoints stay under their own session guard (requireAdmin) and are
 * already blocked from the /api/v1 alias by api-version.ts; this middleware
 * does not weaken either rule.
 */

import { assertWithinRateLimit } from '../utils/rate-limit'

/** Endpoints that must not be rate-limited or token-gated. */
function isExempt(path: string): boolean {
  // Long-lived SSE stream: one connection, not a polling loop.
  if (path.startsWith('/api/stream/')) return true
  if (path.startsWith('/api/v1/stream/')) return true
  // Liveness probe must always answer for the host's health checks.
  if (path === '/api/v1/health') return true
  // The OpenAPI spec is static documentation.
  if (path === '/api/v1/openapi.json') return true
  return false
}

export default defineEventHandler((event) => {
  const path = event.path.split('?')[0] ?? ''
  if (!path.startsWith('/api/')) return

  // ── 3.6 HSTS: tell clients to only ever use HTTPS for this host. ────────
  // Harmless on http://localhost (browsers ignore it), strict in production.
  setResponseHeader(event, 'Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')

  // ── 3.4 Strict CORS: same-origin web + non-browser mobile need nothing. ──
  // We only ever reflect the configured canonical origin, never '*'.
  const origin = getHeader(event, 'origin')
  const siteUrl = useRuntimeConfig(event).public.siteUrl
  if (origin && siteUrl && origin === siteUrl.replace(/\/$/, '')) {
    setResponseHeader(event, 'Access-Control-Allow-Origin', origin)
    setResponseHeader(event, 'Vary', 'Origin')
  }

  if (isExempt(path)) return

  // ── 3.3 App token (only enforced once the secret is configured). ────────
  const config = useRuntimeConfig(event)
  const expectedToken = (config.appToken as string) || ''
  const isVersionedPublic = path.startsWith('/api/v1/')

  if (expectedToken && isVersionedPublic) {
    const presented = getHeader(event, 'x-app-token') ?? ''
    // Browser same-origin calls carry no token and are allowed; a non-browser
    // client (the Flutter app) must present the token. We detect browsers by
    // the Sec-Fetch-Mode header every modern browser sends on fetch().
    const isBrowser = Boolean(getHeader(event, 'sec-fetch-mode'))
    if (!isBrowser && presented !== expectedToken) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
        data: { statusCode: 401, code: 'invalid_app_token', message: 'Missing or invalid app token' },
      })
    }
  }

  // ── 3.5 Rate limiting on the public surface. ────────────────────────────
  if (isVersionedPublic) {
    const token = getHeader(event, 'x-app-token')
    const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
    assertWithinRateLimit(token ? `token:${token}` : `ip:${ip}`)
  }
})
