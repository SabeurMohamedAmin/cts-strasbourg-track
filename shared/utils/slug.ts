/**
 * Station slug helpers.
 *
 * A slug is the URL-safe form of a station name:
 *   "Cité de l'Ill"  → "cite-de-l-ill"
 *   "Hœnheim Gare"   → "hoenheim-gare"
 *
 * Slugs are DERIVED, never stored: the server resolves them by slugifying
 * every stop name from the in-memory stops cache and comparing. This keeps
 * URLs human-readable and shareable without a new database column.
 */
export function slugifyStopName(name: string): string {
  return name
    .normalize('NFD') // é → e + combining accent
    .replace(/[\u0300-\u036f]/g, '') // strip combining accents
    .toLocaleLowerCase('fr')
    .replace(/œ/g, 'oe') // NFD does not decompose ligatures
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, '-') // every other character run → one dash
    .replace(/^-+|-+$/g, '') // no leading/trailing dash
}
