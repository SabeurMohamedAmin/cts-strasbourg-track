import type { H3Event } from 'h3'

/**
 * Absolute site origin (no trailing slash), used to build the URLs in
 * robots.txt and sitemap.xml.
 *
 * Priority:
 *   1. NUXT_PUBLIC_SITE_URL when set (canonical production domain)
 *   2. the origin of the incoming request (works out of the box on Netlify)
 */
export function resolveSiteUrl(event: H3Event): string {
  const configured = useRuntimeConfig(event).public.siteUrl
  const origin = configured || getRequestURL(event).origin
  return withProtocol(origin).replace(/\/$/, '')
}

/**
 * Guarantees the origin has a scheme. Without it, links built from this
 * value (password-reset emails, sitemap entries) are treated as relative
 * paths by browsers and mail click-trackers.
 * "localhost:3000" → "http://localhost:3000"; anything else → https.
 */
function withProtocol(origin: string): string {
  if (/^https?:\/\//.test(origin))
    return origin

  const isLocal = origin.startsWith('localhost') || origin.startsWith('127.0.0.1')
  return `${isLocal ? 'http' : 'https'}://${origin}`
}
