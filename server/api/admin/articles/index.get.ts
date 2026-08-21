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

  // Shared join chain for the page of rows and for the total count.
  const baseJoin = () => db
    .select()
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

  const [itemRows, totalRows] = await Promise.all([
    baseJoin()
      .orderBy(desc(blogArticles.publishedAt))
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage),
    db
      .select({ total: count() })
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
      .where(where),
  ])

  const items: AdminArticleList['items'] = itemRows.map(row => ({
    slug: row.blog_articles.slug,
    title: row.blog_article_translations.title,
    categorySlug: row.blog_categories.slug,
    categoryName: row.blog_category_translations.name,
    status: row.blog_articles.status,
    publishedAt: row.blog_articles.publishedAt,
    readingMinutes: row.blog_articles.readingMinutes,
  }))

  return {
    items,
    total: totalRows[0]?.total ?? 0,
    page: query.page,
    perPage: query.perPage,
  }
})
