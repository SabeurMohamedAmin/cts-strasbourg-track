import { pgTable, serial, text, varchar, integer, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core'

/**
 * Blog content — i18n-ready schema:
 *
 *   blog_categories 1 ───* blog_category_translations (one row per locale)
 *                   1 ───* blog_articles
 *   blog_articles   1 ───* blog_article_translations  (one row per locale)
 *                   1 ───* blog_article_sections      (text blocks, per locale)
 *                   1 ───* blog_article_media         (slider items, ordered)
 *
 * Rule: anything a human READS (names, titles, texts) lives in a
 * translation table. Anything a machine reads (slugs, dates, status,
 * URLs, positions) lives on the parent row.
 *
 * Images are NOT stored in the database: URL columns only point to a
 * third-party cloud (or a YouTube video ID).
 * Deleting an article or a category cascades to its children.
 */

/** A blog category. Its display name lives in blog_category_translations. */
export const blogCategories = pgTable('blog_categories', {
  id:        serial('id').primaryKey(),
  /** URL segment used by filters and admin routes — never expose ids. */
  slug:      text('slug').notNull(),
  /**
   * MDI icon shown on cards and lists. Any new icon must also be
   * registered in `app/utils/mdi-icons.ts` (see the comment there).
   */
  icon:      text('icon').notNull().default('mdi-post-outline'),
  /** Display order in the filter bar (0 = first). */
  position:  integer('position').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ([
  uniqueIndex('blog_categories_slug_idx').on(t.slug),
]))

/** Translated category name — one row per (category, locale). */
export const blogCategoryTranslations = pgTable('blog_category_translations', {
  id:         serial('id').primaryKey(),
  categoryId: integer('category_id').notNull()
    .references(() => blogCategories.id, { onDelete: 'cascade' }),
  /** ISO 639-1 code, see SUPPORTED_LOCALES in shared/types/locale.ts. */
  locale:     varchar('locale', { length: 5 }).notNull(),
  name:       text('name').notNull(),
}, (t) => ([
  uniqueIndex('blog_category_translations_category_locale_idx').on(t.categoryId, t.locale),
]))

/**
 * An article's machine-readable data. Titles, excerpts and SEO fields
 * live in blog_article_translations.
 */
export const blogArticles = pgTable('blog_articles', {
  id:             serial('id').primaryKey(),
  /** URL segment of the article page: /blog/<slug> — never expose ids. */
  slug:           text('slug').notNull(),
  categoryId:     integer('category_id').notNull()
    .references(() => blogCategories.id),
  /** Drafts stay hidden from the public site until published. */
  status:         text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
  /** Publication date, ISO format YYYY-MM-DD (sortable as text). */
  publishedAt:    text('published_at').notNull(),
  readingMinutes: integer('reading_minutes').notNull().default(3),
  /** Main image URL, hosted on a third-party cloud. */
  heroImageUrl:   text('hero_image_url').notNull(),
  /** Tram / bus lines serving the place, e.g. ["A", "D"]. */
  lines:          jsonb('lines').$type<string[]>().notNull().default([]),
  /** Stop names are identical in every locale — no translation needed. */
  nearestStop:    text('nearest_stop').notNull(),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  updatedAt:      timestamp('updated_at').notNull().defaultNow(),
}, (t) => ([
  uniqueIndex('blog_articles_slug_idx').on(t.slug),
  index('blog_articles_category_id_idx').on(t.categoryId),
  index('blog_articles_status_idx').on(t.status),
  index('blog_articles_published_at_idx').on(t.publishedAt),
]))

/** Translated article fields — one row per (article, locale). */
export const blogArticleTranslations = pgTable('blog_article_translations', {
  id:             serial('id').primaryKey(),
  articleId:      integer('article_id').notNull()
    .references(() => blogArticles.id, { onDelete: 'cascade' }),
  locale:         varchar('locale', { length: 5 }).notNull(),
  title:          text('title').notNull(),
  excerpt:        text('excerpt').notNull(),
  /** <title> override for search engines (≤ 60 chars recommended). */
  seoTitle:       text('seo_title'),
  /** Meta description (≤ 160 chars recommended). */
  seoDescription: text('seo_description'),
  /** Closing section shown under the slider. */
  outroTitle:     text('outro_title').notNull(),
  outroText:      text('outro_text').notNull(),
}, (t) => ([
  uniqueIndex('blog_article_translations_article_locale_idx').on(t.articleId, t.locale),
]))

/** One content block (heading + paragraph), per locale, ordered. */
export const blogArticleSections = pgTable('blog_article_sections', {
  id:        serial('id').primaryKey(),
  articleId: integer('article_id').notNull()
    .references(() => blogArticles.id, { onDelete: 'cascade' }),
  locale:    varchar('locale', { length: 5 }).notNull(),
  /** Display order inside the article (0 = first). */
  position:  integer('position').notNull().default(0),
  title:     text('title').notNull(),
  body:      text('body').notNull(),
}, (t) => ([
  index('blog_article_sections_article_locale_idx').on(t.articleId, t.locale),
]))

/** One slide of the article slider: an image URL or a YouTube video. */
export const blogArticleMedia = pgTable('blog_article_media', {
  id:        serial('id').primaryKey(),
  articleId: integer('article_id').notNull()
    .references(() => blogArticles.id, { onDelete: 'cascade' }),
  /** Display order inside the slider (0 = first). */
  position:  integer('position').notNull().default(0),
  type:      text('type', { enum: ['image', 'youtube'] }).notNull(),
  /** Image URL (third-party cloud) or YouTube video ID. */
  src:       text('src').notNull(),
  /** Alt text for images (accessibility). */
  alt:       text('alt'),
}, (t) => ([
  index('blog_article_media_article_idx').on(t.articleId),
]))

export type BlogCategoryRow = typeof blogCategories.$inferSelect
export type BlogCategoryTranslationRow = typeof blogCategoryTranslations.$inferSelect
export type BlogArticleRow = typeof blogArticles.$inferSelect
export type BlogArticleTranslationRow = typeof blogArticleTranslations.$inferSelect
export type BlogArticleSectionRow = typeof blogArticleSections.$inferSelect
export type BlogArticleMediaRow = typeof blogArticleMedia.$inferSelect
