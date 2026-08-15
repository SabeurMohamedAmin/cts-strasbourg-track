import { eq } from 'drizzle-orm'
import { db } from '~~/server/database'
import { blogCategories, blogCategoryTranslations } from '~~/server/database/schema/blog'
import { categoryCreateSchema } from '~~/shared/schemas/admin-blog'

/**
 * POST /api/admin/categories — creates a category (parent row + one
 * translation row per locale in the payload, `fr` only in v1).
 * The slug is generated from the fr name by the form, editable before
 * save — the API only checks it is valid and free (409 otherwise).
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readValidatedBody(event, categoryCreateSchema.parse)

  const [conflict] = await db
    .select({ id: blogCategories.id })
    .from(blogCategories)
    .where(eq(blogCategories.slug, body.slug))
    .limit(1)
  if (conflict) {
    throw createError({ statusCode: 409, statusMessage: 'Ce slug de catégorie existe déjà' })
  }

  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(blogCategories)
      .values({ slug: body.slug, icon: body.icon, position: body.position })
      .returning({ id: blogCategories.id })

    const categoryId = inserted[0]!.id
    await tx.insert(blogCategoryTranslations).values(
      body.translations.map(translation => ({ categoryId, ...translation })),
    )
  })

  setResponseStatus(event, 201)
  return { slug: body.slug }
})
