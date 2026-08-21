import { eq } from 'drizzle-orm'
import { db } from '~~/server/database'
import { blogArticles } from '~~/server/database/schema/blog'

/**
 * DELETE /api/admin/articles/[slug] — removes the article; its
 * translations, sections and media follow through ON DELETE CASCADE.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Slug manquant' })
  }

  const [existing] = await db
    .select({ id: blogArticles.id })
    .from(blogArticles)
    .where(eq(blogArticles.slug, slug))
    .limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })
  }

  await db.delete(blogArticles).where(eq(blogArticles.id, existing.id))

  return { ok: true }
})
