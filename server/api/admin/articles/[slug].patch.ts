import { eq } from 'drizzle-orm'
import { db } from '~~/server/database'
import {
  blogArticles,
  blogArticleTranslations,
  blogArticleSections,
  blogArticleMedia,
  blogCategories,
} from '~~/server/database/schema/blog'
import { articleUpdateSchema } from '~~/shared/schemas/admin-blog'
import { insertArticleContent } from './index.post'

/**
 * PATCH /api/admin/articles/[slug] — full replace: the parent row is
 * updated and every translation / section / media row is rewritten
 * (simple and predictable; ON DELETE CASCADE has nothing left to do).
 *
 * Slug policy: a published slug is a public URL — changing it breaks
 * SEO, so it is LOCKED once the article is published. Renaming stays
 * possible while the article is a draft.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Slug manquant' })
  }

  const body = await readValidatedBody(event, articleUpdateSchema.parse)

  const [existing] = await db
    .select({ id: blogArticles.id, status: blogArticles.status })
    .from(blogArticles)
    .where(eq(blogArticles.slug, slug))
    .limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })
  }

  if (body.slug !== slug) {
    if (existing.status === 'published') {
      throw createError({ statusCode: 409, statusMessage: 'Le slug est verrouillé après publication' })
    }
    const [conflict] = await db
      .select({ id: blogArticles.id })
      .from(blogArticles)
      .where(eq(blogArticles.slug, body.slug))
      .limit(1)
    if (conflict) {
      throw createError({ statusCode: 409, statusMessage: 'Ce slug d’article existe déjà' })
    }
  }

  const [category] = await db
    .select({ id: blogCategories.id })
    .from(blogCategories)
    .where(eq(blogCategories.slug, body.categorySlug))
    .limit(1)
  if (!category) {
    throw createError({ statusCode: 400, statusMessage: 'Catégorie inconnue' })
  }

  await db.transaction(async (tx) => {
    await tx
      .update(blogArticles)
      .set({
        slug: body.slug,
        categoryId: category.id,
        status: body.status,
        publishedAt: body.publishedAt,
        readingMinutes: body.readingMinutes,
        heroImageUrl: body.heroImageUrl,
        lines: body.lines,
        nearestStop: body.nearestStop,
        updatedAt: new Date(),
      })
      .where(eq(blogArticles.id, existing.id))

    // Rewrite all content rows — simpler and safer than diffing.
    await tx.delete(blogArticleTranslations).where(eq(blogArticleTranslations.articleId, existing.id))
    await tx.delete(blogArticleSections).where(eq(blogArticleSections.articleId, existing.id))
    await tx.delete(blogArticleMedia).where(eq(blogArticleMedia.articleId, existing.id))
    await insertArticleContent(tx, existing.id, body)
  })

  return { slug: body.slug }
})
