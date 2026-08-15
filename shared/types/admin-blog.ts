/**
 * Response shapes of the admin blog API (/api/admin/**), shared with the
 * admin pages so useFetch results are fully typed.
 *
 * Payload (request body) types are NOT here: they are inferred from the
 * Zod schemas in shared/schemas/admin-blog.ts.
 */
import type { ArticleMediaInput, ArticleTranslationInput } from '../schemas/admin-blog'

/** One row of the categories table on /admin/categories. */
export interface AdminCategorySummary {
  slug: string
  /** Name in the default locale (fr in v1). */
  name: string
  icon: string
  position: number
  /** How many articles reference the category (drives delete blocking). */
  articleCount: number
}

/** One row of the articles list on /admin/articles. */
export interface AdminArticleListItem {
  slug: string
  /** Title in the default locale (fr in v1). */
  title: string
  categorySlug: string
  categoryName: string
  status: 'draft' | 'published'
  publishedAt: string
  readingMinutes: number
}

/** Paginated payload of GET /api/admin/articles. */
export interface AdminArticleList {
  items: AdminArticleListItem[]
  total: number
  page: number
  perPage: number
}

/** Dashboard numbers returned by GET /api/admin/stats. */
export interface AdminStats {
  articleCount: number
  draftCount: number
  categoryCount: number
  /** Five most recently edited articles, newest first. */
  lastEdited: {
    slug: string
    title: string
    status: 'draft' | 'published'
    /** ISO timestamp of the last edit. */
    updatedAt: string
  }[]
}

/** Full article returned by GET /api/admin/articles/[slug] — mirrors the
 * creation payload so the editor can load → edit → save it unchanged. */
export interface AdminArticleDetail {
  slug: string
  categorySlug: string
  status: 'draft' | 'published'
  publishedAt: string
  readingMinutes: number
  heroImageUrl: string
  lines: string[]
  nearestStop: string
  translations: ArticleTranslationInput[]
  gallery: ArticleMediaInput[]
}
