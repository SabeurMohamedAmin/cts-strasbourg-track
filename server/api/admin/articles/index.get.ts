import { and, count, desc, eq, ilike } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '~~/server/database'
import { blogArticles, blogArticleTranslations, blogCategories, blogCategoryTranslations } from '~~/server/database/schema/blog'
import { DEFAULT_LOCALE } from '~~/shared/types/locale'
import type { AdminArticleList } from '~~/shared/types/admin-blog'

/**
 * GET /api/admin/articles — paginated list for the admin table.
 * Drafts included (unlike the public /api/blog). Filters:
 *   ?search=   case-insensitive match on the translated title,
 *   ?category= category slug,
 *   ?status=   draft | published,
 *   ?page= / ?perPage= pagination (defaults 1 / 20).
 */
const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(160).optional(),
  category: z.string().optional(),
  status: z.enum(['draft', 'published']).optional(),
})

export default defineEventHandler(async (event): Promise<AdminArticleList> => {
  await requireAdmin(event)

  const query = await getValidatedQuery(event, querySchema.parse)

  const conditions = []
  if (query.status) conditions.push(eq(blogArticles.status, query.status))
  if (query.category) conditions.push(eq(blogCategories.slug, query.category))
  if (query.search) conditions.push(ilike(blogArticleTranslations.title, `%${query.search}%`))
  const where = conditions.length > 0 ? and(...conditions) : undefined

  // Same join chain for the page of rows and for the total count.
  const joinedFrom = <T extends Record<string, unknown>>(selection: T) =>
    db
      .select(selection)
      .from(blogArticles)
      .innerJoin(blogArticleTranslations, and(
        eq(blogArticleTranslations.articleId, blogArticles.id),
        eq(blogArticleTranslations.locale, DEFAULT_LOCALE),
      ))
      .innerJoin(blogCategories, eq(blogCategories.id, blogArticles.categoryId))
      .innerJoin(blogCategoryTranslations, and(
        eq(blogCategoryTranslations.categoryId, blogCategories.id),
        eq(blogCategoryTranslations.locale, DEFAULT_LOCALE),
      ))
      .where(where)

  const [items, totals] = await Promise.all([
    joinedFrom({
      slug: blogArticles.slug,
      title: blogArticleTranslations.title,
      categorySlug: blogCategories.slug,
      categoryName: blogCategoryTranslations.name,
      status: blogArticles.status,
      publishedAt: blogArticles.publishedAt,
      readingMinutes: blogArticles.readingMinutes,
    })
      .orderBy(desc(blogArticles.publishedAt))
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage),
    joinedFrom({ total: count() }),
  ])

  return {
    items,
    total: totals[0]?.total ?? 0,
    page: query.page,
    perPage: query.perPage,
  }
})
