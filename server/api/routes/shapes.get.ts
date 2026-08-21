import { asc, eq, sql } from 'drizzle-orm'
import { db } from '~~/server/database'
import { routes } from '~~/server/database/schema/routes'
import { shapes } from '~~/server/database/schema/shapes'
import { stops } from '~~/server/database/schema/stops'
import { stopTimes } from '~~/server/database/schema/stop_times'
import { trips } from '~~/server/database/schema/trips'

/**
 * Complete route geometry for the map.
 *
 * Primary source — GTFS shapes: routes commonly have distinct shapes for
 * each direction, terminus and service branch, grouped here into one
 * MultiLineString per route while avoiding duplicate geometry shared by
 * many trips.
 *
 * Fallback — stop sequences: the CTS feed ships no shapes.txt, leaving the
 * shapes table empty. When a route has no shape geometry, approximate each
 * direction with straight segments between the ordered stops of that
 * direction's longest trip. Coarser than true track geometry, but enough
 * to draw a usable, followable line on the map.
 */

type Line = [number, number][]

/** Coordinates of every distinct GTFS shape attached to a route's trips. */
async function shapeLinesForRoute(routeId: string): Promise<Line[]> {
  const routeShapes = await db
    .selectDistinct({ shapeId: trips.shapeId })
    .from(trips)
    .where(eq(trips.routeId, routeId))

  const shapeIds = routeShapes
    .map(row => row.shapeId)
    .filter((shapeId): shapeId is string => Boolean(shapeId))

  const lines = await Promise.all(shapeIds.map(async (shapeId) => {
    const points = await db
      .select({ longitude: shapes.shapePtLon, latitude: shapes.shapePtLat })
      .from(shapes)
      .where(eq(shapes.shapeId, shapeId))
      .orderBy(asc(shapes.shapePtSequence))

    return points.length >= 2
      ? points.map(point => [point.longitude, point.latitude] as [number, number])
      : null
  }))

  return lines.filter((line): line is Line => line !== null)
}

/**
 * Fallback when the feed has no shapes: one line per direction, connecting
 * the ordered stops of the direction's longest trip (the trip serving the
 * most stops best approximates the full line).
 */
async function stopSequenceLinesForRoute(routeId: string): Promise<Line[]> {
  const representative = await db.execute<{ trip_id: string }>(sql`
    SELECT DISTINCT ON (t.direction_id) st.trip_id
    FROM trips t
    JOIN stop_times st ON st.trip_id = t.trip_id
    WHERE t.route_id = ${routeId}
    GROUP BY t.direction_id, st.trip_id
    ORDER BY t.direction_id, count(*) DESC
  `)

  const lines = await Promise.all(representative.rows.map(async (row) => {
    const points = await db
      .select({ longitude: stops.stopLon, latitude: stops.stopLat })
      .from(stopTimes)
      .innerJoin(stops, eq(stops.stopId, stopTimes.stopId))
      .where(eq(stopTimes.tripId, row.trip_id))
      .orderBy(asc(stopTimes.stopSequence))

    return points.length >= 2
      ? points.map(point => [point.longitude, point.latitude] as [number, number])
      : null
  }))

  return lines.filter((line): line is Line => line !== null)
}

export default defineEventHandler(async () => {
  try {
    const routeRows = await db.select().from(routes)

    const results = await Promise.all(routeRows.map(async (route) => {
      let lineCoordinates = await shapeLinesForRoute(route.routeId)
      if (!lineCoordinates.length) {
        lineCoordinates = await stopSequenceLinesForRoute(route.routeId)
      }
      if (!lineCoordinates.length) return null

      return {
        routeId: route.routeId,
        routeColor: route.routeColor ?? 'c8102e',
        geometry: {
          type: 'MultiLineString' as const,
          coordinates: lineCoordinates,
        },
      }
    }))

    return results.filter((shape): shape is NonNullable<typeof shape> => shape !== null)
  }
  catch (err) {
    // Log the ROOT cause (ENOTFOUND, auth failure, missing env var, …) so it
    // is visible in the server terminal / function logs.
    console.error('[api/routes/shapes] Database query failed:', err)
    throw createError({
      statusCode: 503,
      statusMessage: 'Service Unavailable',
      message: 'Route shapes are temporarily unavailable: the database is unreachable. '
        + 'Check NUXT_DATABASE_URL and the database TLS settings.',
    })
  }
})
