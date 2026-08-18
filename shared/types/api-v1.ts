/**
 * Public API v1 — frozen contract types (ROADMAP_NITRO_API Step 2).
 *
 * Single source of truth for every response served under /api/v1/*.
 * The Flutter client and the Nuxt web app both consume these shapes.
 *
 * RULE (2.7): never break v1. A breaking change ships as /api/v2 while
 * these types keep working unchanged.
 *
 * Transit shapes (stops, vehicles, schedule, geocode) already live in their
 * own files under shared/types/ and are re-used as-is. This file only adds
 * the cross-cutting envelopes and the NEW v1 resources (health, disruptions,
 * devices, widget departures, analytics).
 */

import type { StopArrival, StopServedLine } from './stop'

// ---------------------------------------------------------------------------
// Envelopes (2.2 / 2.3)
// ---------------------------------------------------------------------------

/**
 * Standard error shape. `code` is a stable, machine-readable identifier so
 * clients can branch on it without parsing the human-readable `message`.
 */
export interface ApiError {
  statusCode: number
  code: string
  message: string
}

/** Pagination metadata for list endpoints (limit/offset). */
export interface PaginationMeta {
  /** Items returned in this page. */
  count: number
  /** Total items available, when cheap to compute. */
  total?: number
  limit: number
  offset: number
}

/** Standard success envelope for paginated list endpoints. */
export interface Paginated<T> {
  data: T[]
  meta: PaginationMeta
}

// ---------------------------------------------------------------------------
// Health (6.2)
// ---------------------------------------------------------------------------

export interface HealthStatus {
  /** Overall liveness: 'ok' when the process is up, 'degraded' when a
   *  dependency is down but the API can still answer. */
  status: 'ok' | 'degraded'
  /** ISO 8601 time the check ran. */
  time: string
  checks: {
    /** PostgreSQL reachable (GTFS + blog + disruptions). */
    database: 'up' | 'down'
    /** CTS real-time poller: fresh live data published recently. */
    ctsPoller: 'live' | 'stale' | 'disabled'
  }
}

// ---------------------------------------------------------------------------
// Disruptions (8.2)
// ---------------------------------------------------------------------------

export type DisruptionSeverity = 'info' | 'warning' | 'critical'

export interface Disruption {
  id: number
  title: string
  description: string
  severity: DisruptionSeverity
  /** GTFS route ids affected (empty = network-wide). */
  lineIds: string[]
  /** GTFS stop ids affected (empty = no specific stop). */
  stopIds: string[]
  /** ISO 8601 start / optional end of the disruption window. */
  startsAt: string
  endsAt: string | null
}

// ---------------------------------------------------------------------------
// Devices (8.3)
// ---------------------------------------------------------------------------

export type DevicePlatform = 'android' | 'ios'

export interface DeviceRegistration {
  /** Firebase Cloud Messaging token. */
  fcmToken: string
  platform: DevicePlatform
  /** Favourite GTFS route ids the device wants push alerts for. */
  favoriteLineIds: string[]
}

export interface DeviceRegistered {
  id: number
  ok: true
}

// ---------------------------------------------------------------------------
// Widget — next departures (8.5)
// ---------------------------------------------------------------------------

/** One compact departure for a home-screen widget. */
export interface NextDeparture {
  lineLabel: string
  destination: string
  /** ISO 8601 departure time. */
  departure: string
  status: StopArrival['status']
  routeColor: string
  routeTextColor: string
}

export interface NextDeparturesResponse {
  stopId: string
  stopName: string
  departures: NextDeparture[]
}

// ---------------------------------------------------------------------------
// Analytics (8.7)
// ---------------------------------------------------------------------------

export type TrackPlatform = 'web' | 'android' | 'ios'

export interface TrackEvent {
  /** Stable event name, e.g. 'stop_viewed', 'map_opened'. */
  event: string
  platform: TrackPlatform
  /** Optional free-form properties (kept small). */
  properties?: Record<string, string | number | boolean>
}

export interface TrackAccepted {
  ok: true
}

// Re-export the served-lines shape so widget/departures consumers can
// reference it from this single entry point if they prefer.
export type { StopServedLine }
