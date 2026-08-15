import { count, eq } from 'drizzle-orm'
import { db } from '~~/server/database'
import { blogArticles, blogCategories } from '~~/server/database/schema/blog'
import { categoryDeleteQuerySchema } from '~~/shared/schemas/admin-blog'

/**
 * DELETE /api/admin/categories/[slug]?reassignTo=<slug>
 *
 * A category still used by articles cannot silently disappear:
 * - without `reassignTo`, the request is refused with 409 (the UI shows
 *   the article count and offers a « reassign to… » select),
 * - with `reassignTo`, its articles are moved to the target category
 *   first, then the row is deleted (translations follow via CASCADE).
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Slug manquant' })
  }

  const { reassignTo } = await getValidatedQuery(event, categoryDeleteQuerySchema.parse)
  if (reassignTo === slug) {
    throw createError({ statusCode: 400, statusMessage: 'La catégorie de réaffectation doit être différente' })
  }

  const [category] = await db
    .select({ id: blogCategories.id })
    .from(blogCategories)
    .where(eq(blogCategories.slug, slug))
    .limit(1)
  if (!category) {
    throw createError({ statusCode: 404, statusMessage: 'Catégorie introuvable' })
  }

  const [{ articleCount }] = await db
    .select({ articleCount: count() })
    .from(blogArticles)
    .where(eq(blogArticles.categoryId, category.id))

  if (articleCount! > 0 && !reassignTo) {
    throw createError({
      statusCode: 409,
      statusMessage: `${articleCount} article(s) utilisent encore cette catégorie — indiquez reassignTo`,
    })
  }

  await db.transaction(async (tx) => {
    if (articleCount! > 0 && reassignTo) {
      const [target] = await tx
        .select({ id: blogCategories.id })
        .from(blogCategories)
        .where(eq(blogCategories.slug, reassignTo))
        .limit(1)
      if (!target) {
        throw createError({ statusCode: 404, statusMessage: 'Catégorie de réaffectation introuvable' })
      }
      await tx
        .update(blogArticles)
        .set({ categoryId: target.id })
        .where(eq(blogArticles.categoryId, category.id))
    }

    await tx.delete(blogCategories).where(eq(blogCategories.id, category.id))
  })

  return { ok: true }
})
