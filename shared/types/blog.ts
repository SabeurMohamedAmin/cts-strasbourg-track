/**
 * Blog types shared between the app (pages, components) and the
 * server (API endpoints). The content lives in the database in an
 * i18n-ready schema (see server/database/schema/blog.ts) and images
 * are hosted on a third-party cloud.
 *
 * Categories are data-driven: rows managed from the admin panel, not
 * a hardcoded list. The public API embeds each article's category
 * (translated name + slug + icon), so the blog page derives its
 * filter chips from the fetched articles.
 */

/** A category as embedded in every article returned by the public API. */
export interface BlogCategorySummary {
  /** URL segment used by the filter (?categorie=<slug>). */
  slug: string
  /** Translated display name (fr in v1). */
  name: string
  /** MDI icon, registered in app/utils/mdi-icons.ts. */
  icon: string
  /** Display order in the filter bar (0 = first). */
  position: number
}

/** Keys used by the sort select on the blog page. */
export type SortKey = 'recent' | 'oldest' | 'title' | 'reading'

/** Options for the sort `v-select` (title = label, value = key). */
export const SORT_OPTIONS: { title: string, value: SortKey }[] = [
  { title: 'Plus récents', value: 'recent' },
  { title: 'Plus anciens', value: 'oldest' },
  { title: 'Titre (A → Z)', value: 'title' },
  { title: 'Lecture rapide', value: 'reading' },
]

/** One slide of the article slider: an image URL or a YouTube / Vimeo video. */
export interface BlogMedia {
  type: 'image' | 'youtube' | 'vimeo'
  /** Image URL, or the bare video ID for 'youtube' / 'vimeo'. */
  src: string
  /** Alt text for images (accessibility). */
  alt?: string | null
}

/** One content block of the article page (heading + paragraph). */
export interface BlogSection {
  title: string
  text: string
}

/** Light shape returned by GET /api/blog (list page and sidebar). */
export interface BlogArticleSummary {
  id: number
  slug: string
  title: string
  excerpt: string
  category: BlogCategorySummary
  /** Publication date, ISO format YYYY-MM-DD. */
  date: string
  readingMinutes: number
  lines: string[]
  nearestStop: string
  /** Main image URL (third-party cloud). */
  image: string
}

/** Full shape returned by GET /api/blog/[slug]. */
export interface BlogArticleDetail extends BlogArticleSummary {
  sections: BlogSection[]
  gallery: BlogMedia[]
  outro: BlogSection
  /** SEO overrides — fall back to title / excerpt when null. */
  seoTitle: string | null
  seoDescription: string | null
}

/** Neighbour link for the previous / next navigation. */
export interface BlogArticleNeighbour {
  slug: string
  title: string
}

export interface BlogArticleResponse {
  article: BlogArticleDetail
  previous: BlogArticleNeighbour | null
  next: BlogArticleNeighbour | null
}
