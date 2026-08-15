/**
 * Locales the content database can store.
 *
 * Every human-readable blog field lives in a translation table with a
 * `locale` column. v1 ships French only — adding a language later is:
 *   1. add its code here (one line, e.g. 'en'),
 *   2. insert translation rows for it.
 * No schema migration needed.
 */
export const SUPPORTED_LOCALES = ['fr'] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'fr'

/** Type guard used by API handlers to validate a `?locale=` query param. */
export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}
