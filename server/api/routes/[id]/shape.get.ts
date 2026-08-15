import { db } from '~~/server/database'
import { shapes } from '~~/server/database/schema/shapes'
import { eq, asc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const shapeId = getRouterParam(event, 'id')
  if (!shapeId) throw createError({ statusCode: 400, message: 'shape id required' })

  const points = await db
    .select()
    .from(shapes)
    .where(eq(shapes.shapeId, shapeId))
    .orderBy(asc(shapes.shapePtSequence))

  // Return as GeoJSON LineString
  return {
    type: 'Feature',
    properties: { shapeId },
    geometry: {
      type: 'LineString',
      coordinates: points.map(p => [p.shapePtLon, p.shapePtLat]),
    },
  }
})
