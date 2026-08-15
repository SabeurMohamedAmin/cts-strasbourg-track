/**
 * In-memory rate limit for POST /api/admin/password/forgot.
 *
 * Rule: at most 3 requests per IP per 15-minute window — EVERY request
 * counts (unlike the login limiter, which only counts failures), because
 * each accepted request may send an email.
 *
 * Same trade-off as admin-login-limit: in-memory is fine for a single
 * Nitro instance; move to a shared store if the app is ever scaled out.
 */

const MAX_REQUESTS = 3
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

interface RequestWindow {
  count: number
  /** Epoch ms after which the window expires and the counter resets. */
  resetAt: number
}

const requestsByIp = new Map<string, RequestWindow>()

/** Throws 429 when the IP already used its 3 requests in the window. */
export function assertForgotAllowed(ip: string): void {
  const window = requestsByIp.get(ip)
  if (!window) return

  if (Date.now() >= window.resetAt) {
    requestsByIp.delete(ip)
    return
  }

  if (window.count >= MAX_REQUESTS) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many reset requests. Try again later.',
    })
  }
}

/** Call on every forgot-password request, allowed or not. */
export function recordForgotRequest(ip: string): void {
  const now = Date.now()
  const window = requestsByIp.get(ip)

  if (!window || now >= window.resetAt) {
    requestsByIp.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return
  }

  window.count += 1
}

/** Test helper: wipes every counter (never called by production code). */
export function resetForgotRateLimit(): void {
  requestsByIp.clear()
}
