/**
 * Theoretical timetable shared types.
 * Used by GET /api/stations/:slug/schedule (server) and the /station/[slug] page (client).
 */

/** One timetable row: every scheduled departure minute within a single hour. */
export interface ScheduleHourRow {
  /**
   * Hour since midnight of the SERVICE day. May reach 24 or 25 for
   * after-midnight trips (GTFS "25:10:00" = 01:10 the next day), which
   * keeps late-night rows sorted after 23h. Display with `hour % 24`.
   */
  hour: number
  /** Sorted, de-duplicated minutes (0-59). */
  minutes: number[]
}

/** One travel direction of a line (grouped by GTFS direction_id). */
export interface ScheduleDirection {
  /** GTFS direction_id: 0 = outbound, 1 = return. */
  directionId: number
  /**
   * Main destination shown to riders — the most frequent headsign of the
   * direction. Short-turn trips can end earlier (e.g. "Etoile Bourse").
   */
  headsign: string
  /** Every terminus served in this direction, used to match live arrivals. */
  headsigns: string[]
  hours: ScheduleHourRow[]
}

/** Full-day theoretical timetable of one line at the station. */
export interface ScheduleLine {
  routeId: string
  /** Route short label, e.g. "A", "C6". */
  lineLabel: string
  mode: 'bus' | 'tram'
  /** Route brand color — hex WITHOUT leading #. */
  routeColor: string
  /** Route text color — hex WITHOUT leading #. */
  routeTextColor: string
  directions: ScheduleDirection[]
}

/** Response envelope for GET /api/stations/:slug/schedule */
export interface StopScheduleResponse {
  /** URL slug of the station, e.g. "cite-de-l-ill". */
  slug: string
  /** GTFS ID of the primary platform — used for arrivals and favourites. */
  stopId: string
  stopName: string
  /** Service date, ISO YYYY-MM-DD (Europe/Paris). */
  date: string
  lines: ScheduleLine[]
}
