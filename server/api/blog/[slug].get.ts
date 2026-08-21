import { and, asc, eq } from 'drizzle-orm'
import { db } from '~~/server/database'
import {
  blogArticles,
  blogArticleTranslations,
  blogArticleSections,
  blogArticleMedia,
  blogCategories,
  blogCategoryTranslations,
} from '~~/server/database/schema/blog'
import { DEFAULT_LOCALE, isSupportedLocale } from '~~/shared/types/locale'
import type { BlogArticleResponse, BlogMedia as BlogMediaItem } from '~~/shared/types/blog'

/**
 * GET /api/blog/[slug]?locale=fr — one full published article: its
 * translated fields, sections, gallery and the previous / next
 * neighbours (chronological order) used by the pager at the bottom
 * of the article page. Addressed by slug, never by id.
 */
export default defineEventHandler(async (event): Promise<BlogArticleResponse> => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Slug manquant' })
  }

  const rawLocale = getQuery(event).locale
  const locale = typeof rawLocale === 'string' && isSupportedLocale(rawLocale)
    ? rawLocale
    : DEFAULT_LOCALE

  // Draft preview: /blog/[slug]?preview=1 lets a logged-in admin read a
  // draft at its real URL. Anyone else keeps the published-only rule.
  const wantsPreview = getQuery(event).preview === '1'
  const session = wantsPreview ? await getUserSession(event) : null
  const isAdminPreview = (session?.user as { role?: string } | undefined)?.role === 'admin'

  const [row] = await db
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
      seoTitle: blogArticleTranslations.seoTitle,
      seoDescription: blogArticleTranslations.seoDescription,
      outroTitle: blogArticleTranslations.outroTitle,
      outroText: blogArticleTranslations.outroText,
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
    .where(isAdminPreview
      ? eq(blogArticles.slug, slug)
      : and(eq(blogArticles.slug, slug), eq(blogArticles.status, 'published')))
    .limit(1)

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })
  }

  // Sections, gallery and the chronological list (for previous / next)
  // are independent queries: run them in parallel.
  const [sections, media, ordered] = await Promise.all([
    db.select()
      .from(blogArticleSections)
      .where(and(
        eq(blogArticleSections.articleId, row.id),
        eq(blogArticleSections.locale, locale),
      ))
      .orderBy(asc(blogArticleSections.position)),
    db.select()
      .from(blogArticleMedia)
      .where(eq(blogArticleMedia.articleId, row.id))
      .orderBy(asc(blogArticleMedia.position)),
    db.select({ slug: blogArticles.slug, title: blogArticleTranslations.title })
      .from(blogArticles)
      .innerJoin(blogArticleTranslations, and(
        eq(blogArticleTranslations.articleId, blogArticles.id),
        eq(blogArticleTranslations.locale, locale),
      ))
      .where(eq(blogArticles.status, 'published'))
      .orderBy(asc(blogArticles.publishedAt)),
  ])

  const position = ordered.findIndex(item => item.slug === row.slug)

  // Never cache previews — a draft must not linger in any shared cache.
  setHeader(event, 'Cache-Control', isAdminPreview
    ? 'no-store'
    : 'public, max-age=300, stale-while-revalidate=3600')

  return {
    article: {
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
      sections: sections.map(section => ({ title: section.title, text: section.body })),
      gallery: media.map(item => ({ type: item.type, src: item.src, alt: item.alt }) satisfies BlogMediaItem),
      outro: { title: row.outroTitle, text: row.outroText },
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
    },
    previous: position > 0 ? ordered[position - 1]! : null,
    next: position >= 0 && position < ordered.length - 1 ? ordered[position + 1]! : null,
  }
})
