import { eq } from 'drizzle-orm'
import { db } from '~~/server/database'
import { blogCategories, blogCategoryTranslations } from '~~/server/database/schema/blog'
import { categoryUpdateSchema } from '~~/shared/schemas/admin-blog'

/**
 * PATCH /api/admin/categories/[slug] — partial update: rename (slug
 * and/or translated names), re-icon, reorder. Only the fields present
 * in the body are touched; translations are upserted per locale.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Slug manquant' })
  }

  const body = await readValidatedBody(event, categoryUpdateSchema.parse)

  const [category] = await db
    .select({ id: blogCategories.id })
    .from(blogCategories)
    .where(eq(blogCategories.slug, slug))
    .limit(1)
  if (!category) {
    throw createError({ statusCode: 404, statusMessage: 'Catégorie introuvable' })
  }

  // Renaming the slug must not collide with another category.
  if (body.slug && body.slug !== slug) {
    const [conflict] = await db
      .select({ id: blogCategories.id })
      .from(blogCategories)
      .where(eq(blogCategories.slug, body.slug))
      .limit(1)
    if (conflict) {
      throw createError({ statusCode: 409, statusMessage: 'Ce slug de catégorie existe déjà' })
    }
  }

  await db.transaction(async (tx) => {
    const parentPatch: Partial<typeof blogCategories.$inferInsert> = {}
    if (body.slug !== undefined) parentPatch.slug = body.slug
    if (body.icon !== undefined) parentPatch.icon = body.icon
    if (body.position !== undefined) parentPatch.position = body.position

    if (Object.keys(parentPatch).length > 0) {
      await tx.update(blogCategories).set(parentPatch).where(eq(blogCategories.id, category.id))
    }

    for (const translation of body.translations ?? []) {
      await tx
        .insert(blogCategoryTranslations)
        .values({ categoryId: category.id, ...translation })
        .onConflictDoUpdate({
          target: [blogCategoryTranslations.categoryId, blogCategoryTranslations.locale],
          set: { name: translation.name },
        })
    }
  })

  return { slug: body.slug ?? slug }
})
