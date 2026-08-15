import { eq } from 'drizzle-orm'
import { db } from '~~/server/database'
import {
  blogArticles,
  blogArticleTranslations,
  blogArticleSections,
  blogArticleMedia,
  blogCategories,
} from '~~/server/database/schema/blog'
import { articleCreateSchema, normalizeMediaSrc } from '~~/shared/schemas/admin-blog'
import type { ArticleCreateInput } from '~~/shared/schemas/admin-blog'

/**
 * POST /api/admin/articles — creates an article: parent row +
 * translations + their sections + gallery, in ONE transaction (like the
 * seed script) so a failure never leaves a half-written article.
 * The category is referenced by slug; YouTube sources are normalised
 * to the bare video id before storage.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readValidatedBody(event, articleCreateSchema.parse)

  const [category] = await db
    .select({ id: blogCategories.id })
    .from(blogCategories)
    .where(eq(blogCategories.slug, body.categorySlug))
    .limit(1)
  if (!category) {
    throw createError({ statusCode: 400, statusMessage: 'Catégorie inconnue' })
  }

  const [conflict] = await db
    .select({ id: blogArticles.id })
    .from(blogArticles)
    .where(eq(blogArticles.slug, body.slug))
    .limit(1)
  if (conflict) {
    throw createError({ statusCode: 409, statusMessage: 'Ce slug d’article existe déjà' })
  }

  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(blogArticles)
      .values({
        slug: body.slug,
        categoryId: category.id,
        status: body.status,
        publishedAt: body.publishedAt,
        readingMinutes: body.readingMinutes,
        heroImageUrl: body.heroImageUrl,
        lines: body.lines,
        nearestStop: body.nearestStop,
      })
      .returning({ id: blogArticles.id })

    await insertArticleContent(tx, inserted[0]!.id, body)
  })

  setResponseStatus(event, 201)
  return { slug: body.slug }
})

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Writes the translations, sections and gallery rows of an article.
 * Also used by PATCH /api/admin/articles/[slug] after it wiped the
 * previous rows (full-replace update).
 */
export async function insertArticleContent(tx: Tx, articleId: number, body: ArticleCreateInput): Promise<void> {
  await tx.insert(blogArticleTranslations).values(
    body.translations.map(translation => ({
      articleId,
      locale: translation.locale,
      title: translation.title,
      excerpt: translation.excerpt,
      seoTitle: translation.seoTitle ?? null,
      seoDescription: translation.seoDescription ?? null,
      outroTitle: translation.outroTitle,
      outroText: translation.outroText,
    })),
  )

  const sectionRows = body.translations.flatMap(translation =>
    translation.sections.map((section, position) => ({
      articleId,
      locale: translation.locale,
      position,
      title: section.title,
      body: section.body,
    })),
  )
  if (sectionRows.length > 0) {
    await tx.insert(blogArticleSections).values(sectionRows)
  }

  const mediaRows = body.gallery.map((media, position) => ({
    articleId,
    position,
    type: media.type,
    // Store the bare video id, whatever URL shape was pasted.
    src: normalizeMediaSrc(media),
    alt: media.alt ?? null,
  }))
  if (mediaRows.length > 0) {
    await tx.insert(blogArticleMedia).values(mediaRows)
  }
}
