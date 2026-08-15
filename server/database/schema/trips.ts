import { pgTable, text, integer, index } from 'drizzle-orm/pg-core'

export const trips = pgTable('trips', {
  tripId:        text('trip_id').primaryKey(),
  routeId:       text('route_id').notNull(),
  serviceId:     text('service_id').notNull(),
  shapeId:       text('shape_id'),
  tripHeadsign:  text('trip_headsign'),
  directionId:   integer('direction_id'),
  blockId:       text('block_id'),
  wheelchairAccessible: integer('wheelchair_accessible').default(0),
}, (t) => ([
  index('trips_route_id_idx').on(t.routeId),
  index('trips_service_id_idx').on(t.serviceId),
  index('trips_shape_id_idx').on(t.shapeId),
]))

export type Trip = typeof trips.$inferSelect
