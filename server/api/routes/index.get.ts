import { db } from '~~/server/database'
import { routes } from '~~/server/database/schema/routes'

export default defineEventHandler(async () => {
  try {
    const rows = await db.select().from(routes).orderBy(routes.routeShortName)
    return rows.map(r => ({
      routeId: r.routeId,
      routeShortName: r.routeShortName,
      routeLongName: r.routeLongName,
      routeType: r.routeType,
      routeColor: r.routeColor ?? 'c8102e',
      routeTextColor: r.routeTextColor ?? 'ffffff',
    }))
  }
  catch (err) {
    // Log the ROOT cause (ENOTFOUND, auth failure, missing env var, …) so it
    // shows up in the host's function logs instead of an opaque 500.
    console.error('[api/routes] Database query failed:', err)
    throw createError({
      statusCode: 503,
      statusMessage: 'Service Unavailable',
      message: 'GTFS routes are temporarily unavailable: the database is unreachable. '
        + 'Check NUXT_DATABASE_URL and the database TLS settings.',
    })
  }
})
