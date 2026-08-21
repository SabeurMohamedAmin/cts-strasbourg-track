import { pgTable, text, real, integer, index } from 'drizzle-orm/pg-core'

export const stops = pgTable('stops', {
  stopId:             text('stop_id').primaryKey(),
  /**
   * GTFS stop_code (e.g. "704A").
   * This is the identifier the CTS SIRI real-time API uses — both as the
   * MonitoringRef you send to stop-monitoring and as the StopPointRef it
   * returns in estimated-timetable payloads. stop_id (e.g. "23NOV_01") is
   * only meaningful inside the GTFS dataset itself.
   */
  stopCode:           text('stop_code'),
  stopName:           text('stop_name').notNull(),
  stopLat:            real('stop_lat').notNull(),
  stopLon:            real('stop_lon').notNull(),
  locationType:       integer('location_type').default(0),
  parentStation:      text('parent_station'),
  wheelchairBoarding: integer('wheelchair_boarding').default(0),
  platformCode:       text('platform_code'),
}, (t) => ([
  index('stops_lat_idx').on(t.stopLat),
  index('stops_lon_idx').on(t.stopLon),
  index('stops_name_idx').on(t.stopName),
  index('stops_code_idx').on(t.stopCode),
]))

export type Stop = typeof stops.$inferSelect
