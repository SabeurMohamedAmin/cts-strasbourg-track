/**
 * CTS REST API client — SIRI 2.0 over HTTP Basic Auth.
 *
 * Auth model (confirmed working against the live API):
 *   - username = your API token
 *   - password = "" (empty string)
 *   - transmitted as a standard HTTP Authorization: Basic … header
 *
 * Response format:
 *   CTS answers in JSON — its native format — regardless of the Accept
 *   header. We advertise JSON first anyway, and the parsers built on
 *   siri-document.ts accept both JSON and XML transparently.
 *
 * Endpoints used:
 *   GET /v1/siri/2.0/estimated-timetable — all active trips (vehicle tracking)
 *   GET /v1/siri/2.0/stop-monitoring     — real-time departures at one stop
 *
 * Rate-limit guidance from CTS:
 *   Respect the ValidUntil timestamp in the response — do not poll
 *   more frequently than indicated. Default poll interval is 12 s.
 */

import { useRuntimeConfig } from '#imports'

export interface CtsClientConfig {
  baseUrl: string
  token: string
  timeoutMs: number
}

function getConfig(): CtsClientConfig {
  const config = useRuntimeConfig()
  const configuredTimeout = Number(config.ctsRequestTimeoutMs)
  return {
    baseUrl: ((config.ctsApiBaseUrl as string) || 'https://api.cts-strasbourg.eu').replace(/\/$/, ''),
    token: config.ctsApiToken as string,
    // 5 s is plenty for a healthy real-time API. A short timeout matters:
    // when CTS is down, callers can only fall back to the GTFS schedule
    // ("Horaires théoriques") AFTER this timeout, so a long value would
    // freeze the UI. Override with NUXT_CTS_REQUEST_TIMEOUT_MS if needed.
    timeoutMs: Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : 5_000,
  }
}

export function isCtsTokenConfigured(): boolean {
  const { token } = getConfig()
  return typeof token === 'string' && token.trim().length > 0
}

/** GET an authenticated CTS endpoint and return the raw response body. */
async function ctsGet(path: string, params?: Record<string, string>): Promise<string> {
  const { baseUrl, token, timeoutMs } = getConfig()

  if (!token) {
    throw new Error(
      '[cts-client] NUXT_CTS_API_TOKEN is not set. '
      + 'Set it in your .env file or Netlify environment variables.',
    )
  }

  const search = params ? `?${new URLSearchParams(params)}` : ''
  const url = `${baseUrl}${path}${search}`

  // HTTP Basic Auth: token as username, empty password.
  const credentials = btoa(`${token}:`)

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: 'application/json, application/xml;q=0.9, */*;q=0.8',
      },
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!response.ok) {
      throw new Error(
        `[cts-client] GET ${path} failed: ${response.status} ${response.statusText}`,
      )
    }

    return response.text()
  }
  catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new Error(
        `[cts-client] GET ${path} timed out after ${timeoutMs} ms. `
        + 'Increase NUXT_CTS_REQUEST_TIMEOUT_MS if the CTS service is responding slowly.',
        { cause: error },
      )
    }
    throw error
  }
}

/**
 * Fetch the EstimatedTimetable feed (all active trips, next 60 min).
 * Returns the raw body (JSON or XML) for siri-parser.ts to process.
 */
export function fetchEstimatedTimetable(): Promise<string> {
  return ctsGet('/v1/siri/2.0/estimated-timetable')
}

/**
 * Fetch the StopMonitoring feed for a single stop.
 * Returns the raw body (JSON or XML) for stop-monitoring-parser.ts.
 */
export function fetchStopMonitoring(stopRef: string): Promise<string> {
  return ctsGet('/v1/siri/2.0/stop-monitoring', { MonitoringRef: stopRef })
}
