/**
 * Canonical host redirect — SEO protection for multi-domain setups.
 *
 * The app is reachable through several domains (strasbourgbus.com,
 * strasbourgbus.fr, strasbourgbus.online, strasbourgbustram.fr, the
 * hosting *.code.run URL…). Serving the same content on many hosts
 * splits ranking signals and risks duplicate-content indexing.
 *
 * This middleware 301-redirects every request whose host differs from
 * the canonical one (NUXT_PUBLIC_SITE_URL) to the same path on the
 * canonical domain.
 *
 * It is a no-op when:
 * - NUXT_PUBLIC_SITE_URL is empty (previews), or
 * - the server runs in dev mode (`npm run dev`), or
 * - the request comes from localhost (safety net if a local .env
 *   accidentally sets NUXT_PUBLIC_SITE_URL).
 */

/** Hostnames that must never be redirected. */
const LOCAL_HOSTNAMES = ['localhost', '127.0.0.1', '::1']

export default defineEventHandler((event) => {
  // Never redirect during local development (`nuxt dev`).
  if (import.meta.dev) return

  const siteUrl = useRuntimeConfig(event).public.siteUrl
  if (!siteUrl) return

  const requestUrl = getRequestURL(event)

  // Safety net: never redirect requests made to localhost.
  if (LOCAL_HOSTNAMES.includes(requestUrl.hostname)) return

  const canonicalHost = new URL(siteUrl).host
  if (requestUrl.host === canonicalHost) return

  // Permanent redirect, keeping path and query string.
  return sendRedirect(event, `${siteUrl.replace(/\/$/, '')}${requestUrl.pathname}${requestUrl.search}`, 301)
})
