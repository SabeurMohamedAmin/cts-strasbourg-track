import 'dotenv/config'

/**
 * Public API smoke test — usage: pnpm api:smoke [--write] [--no-sse]
 *
 * Hits every documented /api/v1 endpoint from Node, i.e. exactly like the
 * Flutter app: no browser, no Sec-Fetch-Mode header, so the X-App-Token
 * path of server/middleware/api-security.ts (3.3) is exercised too.
 *
 * Covers ROADMAP_NITRO_API 4.1 (non-browser SSE client with a long-lived
 * connection) and re-checks 4.2 heartbeats and 5.2 ETag revalidation.
 *
 * Requires a running server:  pnpm dev  (or SMOKE_BASE_URL=<staging url>)
 *
 * READ-ONLY by default. Pass --write to also register a device and post a
 * tracking event (both idempotent; the device uses a fixed smoke token).
 */

import { slugifyStopName } from '../shared/utils/slug'

const BASE_URL = (process.env.SMOKE_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const API = `${BASE_URL}/api/v1`
const WITH_WRITES = process.argv.includes('--write')
const SKIP_SSE = process.argv.includes('--no-sse')
/** Heartbeats arrive every 20 s, so allow a little more than that. */
const SSE_TIMEOUT_MS = 25_000

/** A non-browser client must present the app token when one is configured. */
const headers: Record<string, string> = {}
if (process.env.NUXT_APP_TOKEN) headers['x-app-token'] = process.env.NUXT_APP_TOKEN

interface CheckResult {
  name: string
  status: 'pass' | 'fail' | 'skip'
  detail: string
}

const results: CheckResult[] = []

async function check(name: string, run: () => Promise<string>): Promise<void> {
  const started = Date.now()
  try {
    const detail = await run()
    results.push({ name, status: 'pass', detail: `${detail} — ${Date.now() - started}ms` })
  }
  catch (error) {
    results.push({ name, status: 'fail', detail: error instanceof Error ? error.message : String(error) })
  }
}

function skip(name: string, why: string): void {
  results.push({ name, status: 'skip', detail: why })
}

/** GETs a path and fails loudly unless the status matches. */
async function getJson<T>(path: string, expectedStatus = 200): Promise<T> {
  const response = await fetch(`${API}${path}`, { headers })
  if (response.status !== expectedStatus) {
    throw new Error(`GET ${path} → ${response.status}, expected ${expectedStatus}`)
  }
  return await response.json() as T
}

function expectArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`GET ${path} did not return an array`)
  return value
}

/**
 * Opens the SSE stream and waits for a snapshot frame and a heartbeat.
 * This is the check a browser cannot make for us (4.1).
 */
async function readStream(): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SSE_TIMEOUT_MS)

  try {
    const response = await fetch(`${API}/stream/vehicles`, { headers, signal: controller.signal })
    if (response.status !== 200) throw new Error(`stream → ${response.status}, expected 200`)

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/event-stream')) {
      throw new Error(`stream content-type is '${contentType}', expected text/event-stream`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('stream had no body')

    const decoder = new TextDecoder()
    let buffer = ''
    let sawSnapshot = false

    while (true) {
      const { value, done } = await reader.read()
      if (done) throw new Error('stream closed before a heartbeat arrived')

      buffer += decoder.decode(value, { stream: true })
      if (buffer.includes('event: vehicles')) sawSnapshot = true

      // The heartbeat is the point: it proves the connection stays open and
      // that a mobile client can detect a silent drop.
      if (sawSnapshot && buffer.includes('event: heartbeat')) {
        await reader.cancel()
        return 'snapshot frame + heartbeat received'
      }
    }
  }
  catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`no heartbeat within ${SSE_TIMEOUT_MS / 1_000}s`)
    }
    throw error
  }
  finally {
    clearTimeout(timer)
  }
}

/** Status of a HEAD-ish probe, or null when nothing is listening. */
async function probe(path: string): Promise<number | null> {
  try {
    const response = await fetch(`${BASE_URL}${path}`, { headers })
    return response.status
  }
  catch {
    return null
  }
}

/**
 * Tells apart the three failure modes that all look like "everything 404s":
 * no server, a broken /api/v1 alias, or a genuinely failing endpoint.
 * Returns false when there is no point running the rest.
 */
async function preflight(): Promise<boolean> {
  const versioned = await probe('/api/v1/health')
  if (versioned === 200) return true

  const legacy = await probe('/api/health')

  if (versioned === null && legacy === null) {
    console.error(`[smoke] Nothing is listening on ${BASE_URL} — start the server with \`pnpm dev\`.`)
    return false
  }

  if (legacy === 200) {
    console.error(
      `[smoke] /api/health is 200 but /api/v1/health is ${versioned}: the /api/v1 alias is not\n`
      + '        resolving. Check the routeRules entry in nuxt.config.ts\n'
      + "        ('/api/v1/**': { proxy: '/api/**' }), then RESTART the dev server —\n"
      + '        route rules are read at startup and are not hot-reloaded.',
    )
    return false
  }

  console.error(
    `[smoke] Both /api/v1/health (${versioned}) and /api/health (${legacy}) failed: the server is\n`
    + '        running but the API is not healthy. Check the dev server output.',
  )
  return false
}

async function main(): Promise<void> {
  console.info(`[smoke] Target: ${API}`)
  console.info(`[smoke] App token: ${headers['x-app-token'] ? 'sent' : 'not configured'}`)
  console.info(`[smoke] Writes: ${WITH_WRITES ? 'enabled (--write)' : 'skipped'}\n`)

  if (!(await preflight())) {
    process.exitCode = 1
    return
  }

  // Infrastructure ----------------------------------------------------------
  await check('GET /health', async () => {
    const health = await getJson<{ status: string, checks?: Record<string, string> }>('/health')
    return `status=${health.status} db=${health.checks?.database} poller=${health.checks?.ctsPoller}`
  })

  await check('GET /openapi.json', async () => {
    const spec = await getJson<{ openapi?: string, paths?: object }>('/openapi.json')
    if (!spec.openapi || !spec.paths) throw new Error('not an OpenAPI document')
    return `openapi ${spec.openapi}, ${Object.keys(spec.paths).length} paths`
  })

  // Stops -------------------------------------------------------------------
  // Ids and slugs come from the live data: no hard-coded fixtures to rot.
  interface SmokeStop { stopId: string, stopName: string }
  let station: SmokeStop | undefined
  /** False when the feed has no location_type=1 rows and we used a platform. */
  let haveRealStation = false

  await check('GET /stops', async () => {
    const stations = expectArray(await getJson('/stops?type=station'), '/stops?type=station') as SmokeStop[]
    haveRealStation = stations.length > 0

    // A GTFS feed without parent stations is valid, so fall back to platforms
    // rather than reporting every stop endpoint as broken.
    const platforms = haveRealStation
      ? []
      : expectArray(await getJson('/stops'), '/stops') as SmokeStop[]

    station = stations[0] ?? platforms[0]
    if (!station) throw new Error('no stops at all (is the GTFS feed imported?)')

    return haveRealStation
      ? `${stations.length} station(s), first: ${station.stopName}`
      : `0 stations (location_type=1); using 1 of ${platforms.length} platform(s): ${station.stopName}`
  })

  if (!station) {
    skip('stop-specific endpoints', 'no station id available')
  }
  else {
    const id = encodeURIComponent(station.stopId)

    await check('GET /stops/{id}', async () => {
      const stop = await getJson<SmokeStop>(`/stops/${id}`)
      return stop.stopName
    })

    await check('GET /stops/{id}/arrivals', async () => {
      const body = await getJson<{ arrivals: unknown[] }>(`/stops/${id}/arrivals?limit=5`)
      return `${body.arrivals.length} arrival(s)`
    })

    await check('GET /stops/{id}/next-departures', async () => {
      const body = await getJson<{ departures: unknown[] }>(`/stops/${id}/next-departures?limit=3`)
      return `${body.departures.length} departure(s)`
    })

    await check('GET /stops/arrivals?ids=', async () => {
      const body = await getJson<Record<string, unknown>>(`/stops/arrivals?ids=${id}`)
      return `${Object.keys(body).length} stop(s) in the batch`
    })

    if (!haveRealStation) {
      skip('GET /stations/{slug}/schedule', 'no location_type=1 station to resolve a slug from')
    }
    else {
      await check('GET /stations/{slug}/schedule', async () => {
        const slug = slugifyStopName(station!.stopName)
        const body = await getJson<{ lines: unknown[] }>(`/stations/${slug}/schedule`)
        return `slug '${slug}', ${body.lines.length} line(s)`
      })
    }
  }

  await check('GET /stops/nearby', async () => {
    const stops = expectArray(
      await getJson('/stops/nearby?lat=48.5841&lon=7.7446&limit=5'),
      '/stops/nearby',
    )
    return `${stops.length} stop(s) near place Kléber`
  })

  // Routes ------------------------------------------------------------------
  await check('GET /routes', async () => {
    const routes = expectArray(await getJson('/routes'), '/routes')
    return `${routes.length} route(s)`
  })

  await check('GET /routes/shapes', async () => {
    const shapes = expectArray(await getJson('/routes/shapes'), '/routes/shapes')
    return `${shapes.length} route geometr(ies)`
  })

  // /routes/{id}/shape takes a GTFS shape_id, which no list endpoint exposes.
  if (process.env.SMOKE_SHAPE_ID) {
    await check('GET /routes/{id}/shape', async () => {
      const feature = await getJson<{ type: string }>(`/routes/${process.env.SMOKE_SHAPE_ID}/shape`)
      return `GeoJSON ${feature.type}`
    })
  }
  else {
    skip('GET /routes/{id}/shape', 'set SMOKE_SHAPE_ID=<gtfs shape_id> to include it')
  }

  // Vehicles + caching ------------------------------------------------------
  await check('GET /vehicles + ETag 304', async () => {
    const first = await fetch(`${API}/vehicles`, { headers })
    if (first.status !== 200) throw new Error(`/vehicles → ${first.status}`)

    const snapshot = await first.json() as { freshness?: string, vehicles?: unknown[] }
    const etag = first.headers.get('etag')
    if (!etag) throw new Error('no ETag header (5.2)')

    const second = await fetch(`${API}/vehicles`, { headers: { ...headers, 'if-none-match': etag } })
    if (second.status !== 304) throw new Error(`revalidation → ${second.status}, expected 304`)

    return `${snapshot.vehicles?.length ?? 0} vehicle(s), freshness=${snapshot.freshness}, 304 on revalidate`
  })

  // Misc + content ----------------------------------------------------------
  await check('GET /geocode', async () => {
    const hits = expectArray(await getJson('/geocode?q=place%20kleber'), '/geocode')
    return `${hits.length} result(s)`
  })

  await check('GET /eurometropole/bounds', async () => {
    const body = await getJson<{ bounds: number[][] }>('/eurometropole/bounds')
    if (!Array.isArray(body.bounds)) throw new Error('missing bounds')
    return 'bounding box returned'
  })

  interface SmokeArticle { slug: string }
  let article: SmokeArticle | undefined

  await check('GET /blog', async () => {
    const articles = expectArray(await getJson('/blog'), '/blog') as SmokeArticle[]
    article = articles[0]
    return `${articles.length} published article(s)`
  })

  if (article) {
    await check('GET /blog/{slug}', async () => {
      const body = await getJson<{ article: unknown }>(`/blog/${article!.slug}`)
      if (!body.article) throw new Error('no article in the response')
      return article!.slug
    })
  }
  else {
    skip('GET /blog/{slug}', 'no published article to fetch')
  }

  await check('GET /disruptions', async () => {
    const disruptions = expectArray(await getJson('/disruptions'), '/disruptions')
    return `${disruptions.length} active disruption(s)`
  })

  // Writes (opt-in) ---------------------------------------------------------
  if (!WITH_WRITES) {
    skip('POST /devices', 'read-only run, pass --write to include it')
    skip('POST /track', 'read-only run, pass --write to include it')
  }
  else {
    await check('POST /devices', async () => {
      // Fixed token: the endpoint upserts on fcm_token, so repeated runs
      // refresh one row instead of filling the table.
      const response = await fetch(`${API}/devices`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({
          fcmToken: 'smoke-test-token-do-not-push',
          platform: 'android',
          favoriteLineIds: [],
        }),
      })
      if (response.status !== 201) throw new Error(`→ ${response.status}, expected 201`)
      const body = await response.json() as { id: number, ok: boolean }
      return `registered id=${body.id}`
    })

    await check('POST /track', async () => {
      const response = await fetch(`${API}/track`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ event: 'smoke_test', platform: 'android' }),
      })
      if (response.status !== 202) throw new Error(`→ ${response.status}, expected 202`)
      return 'event accepted'
    })
  }

  // SSE last: it holds the connection open for up to 25 s. ------------------
  if (SKIP_SSE) skip('GET /stream/vehicles (SSE)', '--no-sse')
  else await check('GET /stream/vehicles (SSE)', readStream)

  // Report ------------------------------------------------------------------
  const label = { pass: 'PASS', fail: 'FAIL', skip: 'SKIP' } as const
  for (const result of results) {
    console.info(`[${label[result.status]}] ${result.name}: ${result.detail}`)
  }

  const failed = results.filter(result => result.status === 'fail').length
  const passed = results.filter(result => result.status === 'pass').length
  const skipped = results.filter(result => result.status === 'skip').length

  console.info(`\n[smoke] ${passed} passed, ${failed} failed, ${skipped} skipped.`)
  if (failed > 0) process.exitCode = 1
}

await main()
