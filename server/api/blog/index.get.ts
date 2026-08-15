import { and, desc, eq } from 'drizzle-orm'
import { db } from '~~/server/database'
import { blogArticles, blogArticleTranslations, blogCategories, blogCategoryTranslations } from '~~/server/database/schema/blog'
import { DEFAULT_LOCALE, isSupportedLocale } from '~~/shared/types/locale'
import type { BlogArticleSummary } from '~~/shared/types/blog'

/**
 * GET /api/blog?locale=fr — every published article, most recent first.
 * `locale` is validated against SUPPORTED_LOCALES and defaults to `fr`.
 * Light "summary" shape only: sections and gallery are served by
 * GET /api/blog/[slug] when a single article is opened.
 */
export default defineEventHandler(async (event): Promise<BlogArticleSummary[]> => {
  const rawLocale = getQuery(event).locale
  const locale = typeof rawLocale === 'string' && isSupportedLocale(rawLocale)
    ? rawLocale
    : DEFAULT_LOCALE

  const rows = await db
    .select({
      id: blogArticles.id,
      slug: blogArticles.slug,
      date: blogArticles.publishedAt,
      readingMinutes: blogArticles.readingMinutes,
      lines: blogArticles.lines,
      nearestStop: blogArticles.nearestStop,
      image: blogArticles.heroImageUrl,
      title: blogArticleTranslations.title,
      excerpt: blogArticleTranslations.excerpt,
      categorySlug: blogCategories.slug,
      categoryIcon: blogCategories.icon,
      categoryPosition: blogCategories.position,
      categoryName: blogCategoryTranslations.name,
    })
    .from(blogArticles)
    .innerJoin(blogArticleTranslations, and(
      eq(blogArticleTranslations.articleId, blogArticles.id),
      eq(blogArticleTranslations.locale, locale),
    ))
    .innerJoin(blogCategories, eq(blogCategories.id, blogArticles.categoryId))
    .innerJoin(blogCategoryTranslations, and(
      eq(blogCategoryTranslations.categoryId, blogCategories.id),
      eq(blogCategoryTranslations.locale, locale),
    ))
    .where(eq(blogArticles.status, 'published'))
    .orderBy(desc(blogArticles.publishedAt))

  setHeader(event, 'Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')

  return rows.map(row => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    category: {
      slug: row.categorySlug,
      name: row.categoryName,
      icon: row.categoryIcon,
      position: row.categoryPosition,
    },
    date: row.date,
    readingMinutes: row.readingMinutes,
    lines: row.lines,
    nearestStop: row.nearestStop,
    image: row.image,
  }))
})
