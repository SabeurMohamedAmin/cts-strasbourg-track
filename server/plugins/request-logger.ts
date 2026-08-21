/**
 * Lightweight API request logging (ROADMAP #13).
 *
 * Logs one line per /api request with method, path, status and latency,
 * plus a line per unhandled error. Enough to spot slow endpoints and error
 * rates in the host's function logs without any external service.
 *
 * Privacy note: query strings are stripped, so user coordinates
 * (lat/lon on /api/stops/nearby) never end up in the logs.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    event.context.requestStartedAt = Date.now()
  })

  nitroApp.hooks.hook('afterResponse', (event) => {
    const path = event.path.split('?')[0] ?? ''
    if (!path.startsWith('/api/')) return

    const startedAt = event.context.requestStartedAt as number | undefined
    const durationMs = startedAt ? Date.now() - startedAt : 0
    // Split versioned (mobile / web-v1) from legacy unversioned traffic so the
    // FLUTTER 1.8 migration to /api/v1 can be watched in the logs (6.3).
    const version = path.startsWith('/api/v1/') ? 'v1' : 'legacy'
    // Note: for the SSE stream (/api/stream/vehicles) this fires when the
    // connection closes — its duration is the client's connection time.
    console.log(`[api] [${version}] ${event.method} ${path} -> ${getResponseStatus(event)} (${durationMs} ms)`)
  })

  nitroApp.hooks.hook('error', (error, { event }) => {
    const path = event?.path?.split('?')[0] ?? ''
    if (!event || !path.startsWith('/api/')) return
    console.error(`[api] ${event.method} ${path} failed:`, error.message)
  })
})
