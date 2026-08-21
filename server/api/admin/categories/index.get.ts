import { and, asc, count, eq } from 'drizzle-orm'
import { db } from '~~/server/database'
import { blogArticles, blogCategories, blogCategoryTranslations } from '~~/server/database/schema/blog'
import { DEFAULT_LOCALE } from '~~/shared/types/locale'
import type { AdminCategorySummary } from '~~/shared/types/admin-blog'

/**
 * GET /api/admin/categories — every category with its translated name
 * (default locale) and how many articles reference it (the count drives
 * the « delete blocked » state in the UI). Ordered like the filter bar.
 */
export default defineEventHandler(async (event): Promise<AdminCategorySummary[]> => {
  await requireAdmin(event)

  return db
    .select({
      slug: blogCategories.slug,
      name: blogCategoryTranslations.name,
      icon: blogCategories.icon,
      position: blogCategories.position,
      articleCount: count(blogArticles.id),
    })
    .from(blogCategories)
    .innerJoin(blogCategoryTranslations, and(
      eq(blogCategoryTranslations.categoryId, blogCategories.id),
      eq(blogCategoryTranslations.locale, DEFAULT_LOCALE),
    ))
    .leftJoin(blogArticles, eq(blogArticles.categoryId, blogCategories.id))
    .groupBy(blogCategories.id, blogCategoryTranslations.name)
    .orderBy(asc(blogCategories.position), asc(blogCategories.slug))
})
