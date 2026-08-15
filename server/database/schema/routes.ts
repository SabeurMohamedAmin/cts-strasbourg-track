import { pgTable, text, integer } from 'drizzle-orm/pg-core'

export const routes = pgTable('routes', {
  routeId:        text('route_id').primaryKey(),
  agencyId:       text('agency_id'),
  routeShortName: text('route_short_name').notNull(),
  routeLongName:  text('route_long_name'),
  routeType:      integer('route_type').notNull(), // 0=tram, 3=bus
  routeColor:     text('route_color'),
  routeTextColor: text('route_text_color'),
  routeDesc:      text('route_desc'),
})

export type Route = typeof routes.$inferSelect
