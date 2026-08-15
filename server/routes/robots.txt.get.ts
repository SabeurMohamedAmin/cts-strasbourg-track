import { resolveSiteUrl } from '../utils/site-url'

/**
 * GET /robots.txt — served dynamically (instead of public/robots.txt)
 * so the Sitemap line can carry the absolute URL search engines require.
 */
export default defineEventHandler((event) => {
  const siteUrl = resolveSiteUrl(event)

  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600')

  return [
    'User-Agent: *',
    'Allow: /',
    // The private admin area is never crawled. Its pages also send an
    // X-Robots-Tag: noindex header (see routeRules in nuxt.config.ts).
    'Disallow: /admin',
    'Disallow: /api/admin',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n')
})
