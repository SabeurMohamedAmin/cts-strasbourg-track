/**
 * In-memory rate limit for POST /api/admin/login.
 *
 * Rule: at most 5 FAILED attempts per IP per 15-minute window.
 * A successful login clears the counter for that IP.
 *
 * In-memory is enough for v1: the app runs as a single Nitro instance and
 * a restart simply resets the counters (an acceptable trade-off for an
 * admin login page). If the app is ever scaled to several instances, move
 * this map to a shared store (Redis / useStorage).
 */

const MAX_FAILED_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

interface AttemptWindow {
  failedCount: number
  /** Epoch ms after which the window expires and the counter resets. */
  resetAt: number
}

const attemptsByIp = new Map<string, AttemptWindow>()

/** Throws 429 when the IP already burned its 5 attempts in the window. */
export function assertLoginAllowed(ip: string): void {
  const window = attemptsByIp.get(ip)
  if (!window) return

  // Expired window → forget it, the visitor starts fresh.
  if (Date.now() >= window.resetAt) {
    attemptsByIp.delete(ip)
    return
  }

  if (window.failedCount >= MAX_FAILED_ATTEMPTS) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many login attempts. Try again later.',
    })
  }
}

/** Call after every wrong password. Opens a window on the first failure. */
export function recordFailedLogin(ip: string): void {
  const now = Date.now()
  const window = attemptsByIp.get(ip)

  if (!window || now >= window.resetAt) {
    attemptsByIp.set(ip, { failedCount: 1, resetAt: now + WINDOW_MS })
    return
  }

  window.failedCount += 1
}

/** Call after a successful login so honest typos are forgiven. */
export function clearLoginAttempts(ip: string): void {
  attemptsByIp.delete(ip)
}

/** Test helper: wipes every counter (never called by production code). */
export function resetLoginRateLimit(): void {
  attemptsByIp.clear()
}
