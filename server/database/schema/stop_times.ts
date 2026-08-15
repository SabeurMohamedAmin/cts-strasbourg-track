import { pgTable, text, integer, boolean, index } from 'drizzle-orm/pg-core'

export const stopTimes = pgTable('stop_times', {
  id:            text('id').primaryKey(), // tripId + '_' + sequence
  tripId:        text('trip_id').notNull(),
  arrivalTime:   text('arrival_time').notNull(),   // HH:MM:SS (can exceed 24h)
  departureTime: text('departure_time').notNull(),
  stopId:        text('stop_id').notNull(),
  stopSequence:  integer('stop_sequence').notNull(),
  stopHeadsign:  text('stop_headsign'),
  pickupType:    integer('pickup_type').default(0),
  dropOffType:   integer('drop_off_type').default(0),
  shapeDistTraveled: text('shape_dist_traveled'),
  timepoint:     boolean('timepoint').default(true),
}, (t) => ([
  index('stop_times_trip_id_idx').on(t.tripId),
  index('stop_times_stop_id_idx').on(t.stopId),
]))

export type StopTime = typeof stopTimes.$inferSelect
