import { pgTable, text, boolean, integer } from 'drizzle-orm/pg-core'

export const calendar = pgTable('calendar', {
  serviceId:  text('service_id').primaryKey(),
  monday:     boolean('monday').notNull(),
  tuesday:    boolean('tuesday').notNull(),
  wednesday:  boolean('wednesday').notNull(),
  thursday:   boolean('thursday').notNull(),
  friday:     boolean('friday').notNull(),
  saturday:   boolean('saturday').notNull(),
  sunday:     boolean('sunday').notNull(),
  startDate:  text('start_date').notNull(), // YYYYMMDD
  endDate:    text('end_date').notNull(),
})

export const calendarDates = pgTable('calendar_dates', {
  id:            text('id').primaryKey(), // serviceId + '_' + date
  serviceId:     text('service_id').notNull(),
  date:          text('date').notNull(),      // YYYYMMDD
  exceptionType: integer('exception_type').notNull(), // 1=added, 2=removed
})

export type Calendar = typeof calendar.$inferSelect
export type CalendarDate = typeof calendarDates.$inferSelect
