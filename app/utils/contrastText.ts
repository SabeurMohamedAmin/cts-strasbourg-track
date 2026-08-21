/**
 * Pick a readable text colour (black or white) for a given background.
 *
 * GTFS `route_text_color` values are not always WCAG-compliant, so we
 * recompute the text colour from the perceived luminance of the badge
 * background instead (ITU-R BT.601 weights).
 *
 * @param backgroundHex Hex colour, with or without a leading '#'.
 */
export function contrastTextColor(backgroundHex: string): '#000000' | '#FFFFFF' {
  const hex = backgroundHex.replace('#', '')
  const red = Number.parseInt(hex.slice(0, 2), 16) || 0
  const green = Number.parseInt(hex.slice(2, 4), 16) || 0
  const blue = Number.parseInt(hex.slice(4, 6), 16) || 0
  const luminance = 0.299 * red + 0.587 * green + 0.114 * blue
  return luminance > 150 ? '#000000' : '#FFFFFF'
}
