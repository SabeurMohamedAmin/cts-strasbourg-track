import { pgTable, text, real, integer, index } from 'drizzle-orm/pg-core'

export const shapes = pgTable('shapes', {
  id:                text('id').primaryKey(), // shapeId + '_' + sequence
  shapeId:           text('shape_id').notNull(),
  shapePtLat:        real('shape_pt_lat').notNull(),
  shapePtLon:        real('shape_pt_lon').notNull(),
  shapePtSequence:   integer('shape_pt_sequence').notNull(),
  shapeDistTraveled: real('shape_dist_traveled'),
}, (t) => ([
  index('shapes_shape_id_idx').on(t.shapeId),
]))

export type Shape = typeof shapes.$inferSelect
