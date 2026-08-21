import { eq } from 'drizzle-orm'
import { db } from '~~/server/database'
import { blogArticles } from '~~/server/database/schema/blog'
import { resolveSiteUrl } from '../utils/site-url'

/**
 * GET /sitemap.xml — the URLs search engines should crawl:
 *   - the static pages (home, plan, live, blog, editorial pages…)
 *   - every published blog article, with its last update date
 *
 * Kept simple on purpose: one <urlset>, well under the 50 000 URL limit.
 */

/** Static, always-crawlable pages of the app. */
const STATIC_PAGES = [
  '/',
  '/plan',
  '/live',
  '/favoris',
  '/blog',
  '/a-propos',
  '/contact',
  '/confidentialite',
  '/conditions-utilisation',
  '/mentions-legales',
]

interface SitemapUrl {
  loc: string
  lastmod?: string
}

/** Builds one <url> entry. */
function urlEntry(url: SitemapUrl): string {
  const lastmod = url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ''
  return `<url><loc>${url.loc}</loc>${lastmod}</url>`
}

export default defineEventHandler(async (event) => {
  const siteUrl = resolveSiteUrl(event)

  const urls: SitemapUrl[] = STATIC_PAGES.map(path => ({ loc: `${siteUrl}${path}` }))

  // Blog articles come from the database. If it is unreachable the
  // sitemap still answers with the static pages instead of a 500.
  try {
    // Published only — drafts must never leak into the sitemap.
    const rows = await db
      .select({ slug: blogArticles.slug, updatedAt: blogArticles.updatedAt })
      .from(blogArticles)
      .where(eq(blogArticles.status, 'published'))

    for (const row of rows) {
      urls.push({
        loc: `${siteUrl}/blog/${row.slug}`,
        lastmod: row.updatedAt.toISOString().slice(0, 10),
      })
    }
  }
  catch (error) {
    console.warn('[sitemap] Blog URLs skipped (database unreachable):', error)
  }

  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(urlEntry),
    '</urlset>',
  ].join('\n')
})
