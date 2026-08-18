/**
 * Standard API error helper (ROADMAP_NITRO_API 2.2).
 *
 * Every public v1 error carries a stable, machine-readable `code` alongside
 * the human-readable `message`, so clients can branch without string parsing:
 *
 *   throw apiError(404, 'stop_not_found', 'Arrêt introuvable')
 *
 * Nitro serialises the `data` object into the response body, so the wire
 * shape is { statusCode, code, message } — matching shared/types/api-v1.ts.
 */
export function apiError(statusCode: number, code: string, message: string) {
  return createError({
    statusCode,
    // `data` lands in the JSON body; statusMessage stays a short HTTP reason.
    data: { statusCode, code, message },
    message,
  })
}
