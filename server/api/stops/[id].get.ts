import { db } from '~~/server/database'
import { stops } from '~~/server/database/schema/stops'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'stop id required' })

  const [stop] = await db.select().from(stops).where(eq(stops.stopId, id))
  if (!stop) throw createError({ statusCode: 404, message: 'Stop not found' })

  return stop
})
