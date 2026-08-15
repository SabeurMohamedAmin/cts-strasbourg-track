import { and, count, desc, eq } from 'drizzle-orm'
import { db } from '~~/server/database'
import { blogArticles, blogArticleTranslations, blogCategories } from '~~/server/database/schema/blog'
import { DEFAULT_LOCALE } from '~~/shared/types/locale'
import type { AdminStats } from '~~/shared/types/admin-blog'

/**
 * GET /api/admin/stats — the dashboard numbers, cheap queries only:
 * three COUNTs and the five most recently edited articles.
 */
export default defineEventHandler(async (event): Promise<AdminStats> => {
  await requireAdmin(event)

  const [articles, drafts, categories, lastEdited] = await Promise.all([
    db.select({ value: count() }).from(blogArticles),
    db.select({ value: count() }).from(blogArticles).where(eq(blogArticles.status, 'draft')),
    db.select({ value: count() }).from(blogCategories),
    db.select({
      slug: blogArticles.slug,
      title: blogArticleTranslations.title,
      status: blogArticles.status,
      updatedAt: blogArticles.updatedAt,
    })
      .from(blogArticles)
      .innerJoin(blogArticleTranslations, and(
        eq(blogArticleTranslations.articleId, blogArticles.id),
        eq(blogArticleTranslations.locale, DEFAULT_LOCALE),
      ))
      .orderBy(desc(blogArticles.updatedAt))
      .limit(5),
  ])

  return {
    articleCount: articles[0]?.value ?? 0,
    draftCount: drafts[0]?.value ?? 0,
    categoryCount: categories[0]?.value ?? 0,
    lastEdited: lastEdited.map(article => ({
      slug: article.slug,
      title: article.title,
      status: article.status,
      updatedAt: article.updatedAt.toISOString(),
    })),
  }
})
