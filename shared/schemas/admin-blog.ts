/**
 * Zod schemas for the admin blog API — the single source of truth for
 * validation, shared by:
 *   - server handlers in server/api/admin/** (readValidatedBody),
 *   - admin forms in app/pages/admin/** (client-side validation).
 *
 * Payloads carry a `translations` array keyed by locale: the admin UI
 * only fills `fr` in v1, but the API is already multilingual.
 *
 * Media rule: `src` must be an https URL on an allowlisted host (image)
 * or a parseable YouTube / Vimeo video id / URL. Bad links can't be
 * saved — the same helpers run in the browser and on the server.
 */
import { z } from 'zod'
import { SUPPORTED_LOCALES } from '../types/locale'

// ── Slugs ─────────────────────────────────────────────────────────────

/** `/admin/articles/new` is the creation page — never a real article. */
export const RESERVED_SLUGS: readonly string[] = ['new']

export const slugSchema = z
  .string()
  .min(1, 'Le slug est requis')
  .max(120, '120 caractères maximum')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Minuscules, chiffres et tirets uniquement (ex. : petite-france)')
  .refine(slug => !RESERVED_SLUGS.includes(slug), 'Ce slug est réservé')

/** Turns a title into a slug suggestion: "Musée d’Art" → "musee-d-art". */
export function slugifyTitle(title: string): string {
  return title
    .normalize('NFD') // é → e + combining accent
    .replace(/[\u0300-\u036f]/g, '') // strip combining accents
    .toLocaleLowerCase('fr')
    .replace(/œ/g, 'oe') // NFD does not decompose ligatures
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, '-') // every other character run → one dash
    .replace(/^-+|-+$/g, '') // no leading/trailing dash
    .slice(0, 120)
}

// ── Media allowlist ─────────────────────────────────────────────────

/**
 * Hosts an image URL may point to. Cloudinary is the real image storage
 * (uploads from the admin editor land there); picsum stays for the seeds.
 */
export const ALLOWED_IMAGE_HOSTS: readonly string[] = [
  'picsum.photos',
  'res.cloudinary.com',
]

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

/**
 * Extracts the 11-character YouTube video id from a raw id or any usual
 * YouTube URL shape (watch?v=, youtu.be/, /embed/, /shorts/, /live/).
 * Returns null when nothing parseable is found — the DB only ever
 * stores the bare id.
 */
export function parseYoutubeId(src: string): string | null {
  if (YOUTUBE_ID_PATTERN.test(src)) return src

  let url: URL
  try {
    url = new URL(src)
  }
  catch {
    return null
  }

  const host = url.hostname.replace(/^www\./, '')
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1)
    return YOUTUBE_ID_PATTERN.test(id) ? id : null
  }
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const fromQuery = url.searchParams.get('v')
    if (fromQuery && YOUTUBE_ID_PATTERN.test(fromQuery)) return fromQuery
    const fromPath = url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/)
    return fromPath ? fromPath[1]! : null
  }
  return null
}

const VIMEO_ID_PATTERN = /^\d{6,12}$/

/**
 * Extracts the numeric Vimeo video id from a raw id or a usual Vimeo
 * URL shape (vimeo.com/123…, vimeo.com/channels/x/123…,
 * player.vimeo.com/video/123…). Returns null when nothing parseable
 * is found — like YouTube, the DB only ever stores the bare id.
 */
export function parseVimeoId(src: string): string | null {
  if (VIMEO_ID_PATTERN.test(src)) return src

  let url: URL
  try {
    url = new URL(src)
  }
  catch {
    return null
  }

  const host = url.hostname.replace(/^www\./, '')
  if (host !== 'vimeo.com' && host !== 'player.vimeo.com') return null

  // The id is the last numeric path segment, whatever comes before it.
  const match = url.pathname.match(/\/(\d{6,12})(?:\/|$)/)
  return match ? match[1]! : null
}

/** True when `src` is an https URL on one of ALLOWED_IMAGE_HOSTS. */
export function isAllowedImageUrl(src: string): boolean {
  let url: URL
  try {
    url = new URL(src)
  }
  catch {
    return false
  }
  return url.protocol === 'https:' && ALLOWED_IMAGE_HOSTS.includes(url.hostname)
}

const allowedImageUrlSchema = z
  .string()
  .refine(isAllowedImageUrl, `URL https requise sur un domaine autorisé : ${ALLOWED_IMAGE_HOSTS.join(', ')}`)

// ── Shared pieces ───────────────────────────────────────────────────────

const localeSchema = z.enum(SUPPORTED_LOCALES)

/** Rejects two translations for the same locale in one payload. */
function uniqueLocales(translations: { locale: string }[]): boolean {
  return new Set(translations.map(t => t.locale)).size === translations.length
}

// ── Categories ──────────────────────────────────────────────────────────

export const categoryTranslationSchema = z.object({
  locale: localeSchema,
  name: z.string().min(1, 'Le nom est requis').max(80),
})

export const categoryCreateSchema = z.object({
  slug: slugSchema,
  /** MDI icon — must be registered in app/utils/mdi-icons.ts. */
  icon: z.string().regex(/^mdi-[a-z0-9-]+$/, 'Nom d’icône MDI attendu (ex. : mdi-tram)').default('mdi-post-outline'),
  position: z.number().int().min(0).default(0),
  translations: z.array(categoryTranslationSchema).min(1).refine(uniqueLocales, 'Une seule traduction par locale'),
})

/** PATCH accepts any subset of the creation fields. */
export const categoryUpdateSchema = categoryCreateSchema.partial()

/** DELETE query: where to move the articles of the deleted category. */
export const categoryDeleteQuerySchema = z.object({
  reassignTo: slugSchema.optional(),
})

// ── Articles ────────────────────────────────────────────────────────────

export const articleSectionSchema = z.object({
  title: z.string().min(1, 'Le titre de section est requis').max(160),
  body: z.string().min(1, 'Le texte de section est requis'),
})

export const articleMediaSchema = z
  .object({
    type: z.enum(['image', 'youtube', 'vimeo']),
    /** Image URL (allowlisted host) or YouTube / Vimeo id / URL. */
    src: z.string().min(1, 'La source est requise'),
    alt: z.string().max(200).nullish(),
  })
  .superRefine((media, ctx) => {
    if (media.type === 'image' && !isAllowedImageUrl(media.src)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['src'],
        message: `URL https requise sur un domaine autorisé : ${ALLOWED_IMAGE_HOSTS.join(', ')}`,
      })
    }
    if (media.type === 'youtube' && parseYoutubeId(media.src) === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['src'],
        message: 'Identifiant ou URL YouTube invalide',
      })
    }
    if (media.type === 'vimeo' && parseVimeoId(media.src) === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['src'],
        message: 'Identifiant ou URL Vimeo invalide',
      })
    }
  })

/**
 * What actually goes into the blog_article_media.src column: the bare
 * video id for videos (whatever URL shape was pasted), the image URL
 * otherwise. Callers run this AFTER articleMediaSchema validated the
 * media, so the non-null assertions are safe.
 */
export function normalizeMediaSrc(media: { type: 'image' | 'youtube' | 'vimeo', src: string }): string {
  if (media.type === 'youtube') return parseYoutubeId(media.src)!
  if (media.type === 'vimeo') return parseVimeoId(media.src)!
  return media.src
}

export const articleTranslationSchema = z.object({
  locale: localeSchema,
  title: z.string().min(1, 'Le titre est requis').max(160),
  excerpt: z.string().min(1, 'L’extrait est requis').max(300),
  /** ≤ 60 chars — what Google displays in the result title. */
  seoTitle: z.string().max(60).nullish(),
  /** ≤ 160 chars — what Google displays as the snippet. */
  seoDescription: z.string().max(160).nullish(),
  outroTitle: z.string().min(1, 'Le titre de l’outro est requis').max(160),
  outroText: z.string().min(1, 'Le texte de l’outro est requis'),
  /** Content blocks of this locale, in display order. */
  sections: z.array(articleSectionSchema).max(20).default([]),
})

export const articleCreateSchema = z.object({
  slug: slugSchema,
  /** Category referenced by slug — the API resolves it to its DB id. */
  categorySlug: slugSchema,
  status: z.enum(['draft', 'published']).default('draft'),
  /** ISO date YYYY-MM-DD (sortable as text). */
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu : AAAA-MM-JJ'),
  readingMinutes: z.number().int().min(1).max(120).default(3),
  heroImageUrl: allowedImageUrlSchema,
  /** Tram / bus lines serving the place, e.g. ["A", "D"]. */
  lines: z.array(z.string().min(1).max(3)).max(12).default([]),
  nearestStop: z.string().min(1, 'L’arrêt le plus proche est requis').max(120),
  translations: z.array(articleTranslationSchema).min(1).refine(uniqueLocales, 'Une seule traduction par locale'),
  gallery: z.array(articleMediaSchema).max(12).default([]),
})

/**
 * PATCH replaces the whole article (translations / sections / media rows
 * are rewritten), so it validates the same full payload. The slug lock
 * for published articles is enforced by the handler, which knows the
 * current status.
 */
export const articleUpdateSchema = articleCreateSchema

// ── Inferred payload types (used by handlers and forms) ───────────────────

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>
export type ArticleTranslationInput = z.infer<typeof articleTranslationSchema>
export type ArticleMediaInput = z.infer<typeof articleMediaSchema>
export type ArticleCreateInput = z.infer<typeof articleCreateSchema>
export type ArticleUpdateInput = z.infer<typeof articleUpdateSchema>
