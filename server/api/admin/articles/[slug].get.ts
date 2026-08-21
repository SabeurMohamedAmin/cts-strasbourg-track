import { asc, eq } from 'drizzle-orm'
import { db } from '~~/server/database'
import {
  blogArticles,
  blogArticleTranslations,
  blogArticleSections,
  blogArticleMedia,
  blogCategories,
} from '~~/server/database/schema/blog'
import type { AdminArticleDetail } from '~~/shared/types/admin-blog'

/**
 * GET /api/admin/articles/[slug] — the full article in the same shape
 * as the creation payload (translations incl. their sections, gallery),
 * so the editor can load → edit → PATCH it back without remapping.
 * Drafts are visible here (admin only) — addressed by slug, never id.
 */
export default defineEventHandler(async (event): Promise<AdminArticleDetail> => {
  await requireAdmin(event)

  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Slug manquant' })
  }

  const [article] = await db
    .select({
      id: blogArticles.id,
      slug: blogArticles.slug,
      categorySlug: blogCategories.slug,
      status: blogArticles.status,
      publishedAt: blogArticles.publishedAt,
      readingMinutes: blogArticles.readingMinutes,
      heroImageUrl: blogArticles.heroImageUrl,
      lines: blogArticles.lines,
      nearestStop: blogArticles.nearestStop,
    })
    .from(blogArticles)
    .innerJoin(blogCategories, eq(blogCategories.id, blogArticles.categoryId))
    .where(eq(blogArticles.slug, slug))
    .limit(1)

  if (!article) {
    throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })
  }

  const [translations, sections, media] = await Promise.all([
    db.select()
      .from(blogArticleTranslations)
      .where(eq(blogArticleTranslations.articleId, article.id)),
    db.select()
      .from(blogArticleSections)
      .where(eq(blogArticleSections.articleId, article.id))
      .orderBy(asc(blogArticleSections.position)),
    db.select()
      .from(blogArticleMedia)
      .where(eq(blogArticleMedia.articleId, article.id))
      .orderBy(asc(blogArticleMedia.position)),
  ])

  return {
    slug: article.slug,
    categorySlug: article.categorySlug,
    status: article.status,
    publishedAt: article.publishedAt,
    readingMinutes: article.readingMinutes,
    heroImageUrl: article.heroImageUrl,
    lines: article.lines,
    nearestStop: article.nearestStop,
    translations: translations.map(translation => ({
      locale: translation.locale as AdminArticleDetail['translations'][number]['locale'],
      title: translation.title,
      excerpt: translation.excerpt,
      seoTitle: translation.seoTitle,
      seoDescription: translation.seoDescription,
      outroTitle: translation.outroTitle,
      outroText: translation.outroText,
      sections: sections
        .filter(section => section.locale === translation.locale)
        .map(section => ({ title: section.title, body: section.body })),
    })),
    gallery: media.map(item => ({ type: item.type, src: item.src, alt: item.alt })),
  }
})
