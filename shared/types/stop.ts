/**
 * Stop-related shared types.
 * Used by both the server API handler and the client composable.
 */

/** One upcoming departure at a stop. */
export interface StopArrival {
  /** GTFS trip ID */
  tripId: string
  /** Route short label, e.g. "A", "6" */
  lineLabel: string
  /** Headsign / final destination */
  destination: string
  /** ISO 8601 wall-clock time of scheduled arrival at this stop */
  scheduledArrival: string
  /** Transport mode */
  mode: 'bus' | 'tram'
  /** Route brand color — hex WITHOUT leading # */
  routeColor: string
  /** Route text color — hex WITHOUT leading # */
  routeTextColor: string
  /**
   * Data nature.
   *   "live"      — CTS SIRI StopMonitoring real-time feed (Phase E)
   *   "estimated" — reserved for interpolated times
   *   "scheduled" — theoretical GTFS timetable fallback
   */
  status: 'live' | 'estimated' | 'scheduled'
}

/** A transport line serving the station, regardless of the next departure. */
export interface StopServedLine {
  routeId: string
  lineLabel: string
  mode: 'bus' | 'tram'
  routeColor: string
  routeTextColor: string
}

/** Response envelope for GET /api/stops/:id/arrivals */
export interface StopArrivalsResponse {
  stopId: string
  stopName: string
  servedLines: StopServedLine[]
  arrivals: StopArrival[]
}
