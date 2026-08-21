import { getAllStops } from '~~/server/services/stops-cache'
import { getStopModes } from '~~/server/services/stop-modes'

const R = 6_371_000 // Earth radius in metres

/** Metres covered by one degree of latitude (and of longitude at the equator). */
const METRES_PER_DEGREE = 111_320

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default defineEventHandler(async (event) => {
  const { lat, lon, limit = '5', radius = '1000' } = getQuery(event)

  if (!lat || !lon)
    throw createError({ statusCode: 400, message: 'lat and lon are required' })

  const latN = parseFloat(lat as string)
  const lonN = parseFloat(lon as string)
  // 30 matches nearbyFetchLimit in the Flutter client: the mobile home page
  // fetches candidates for its client-side tram/bus filter in one request.
  const limitN = Math.min(30, Math.max(1, parseInt(limit as string, 10)))
  const radiusN = Math.min(20_000, Math.max(50, parseFloat(radius as string)))

  if (![latN, lonN, limitN, radiusN].every(Number.isFinite)
    || latN < -90 || latN > 90 || lonN < -180 || lonN > 180) {
    throw createError({ statusCode: 400, message: 'Invalid nearby-stop parameters' })
  }

  // Stops and served lines only change on GTFS imports, so both come from
  // shared in-memory caches instead of heavy queries on every location fix.
  const [all, membershipByStop] = await Promise.all([getAllStops(), getStopModes()])

  // Cheap bounding-box pre-filter: rules out most of the network with two
  // comparisons before paying for the trigonometric haversine distance.
  const latDelta = radiusN / METRES_PER_DEGREE
  const lonDelta = radiusN / (METRES_PER_DEGREE * Math.max(0.01, Math.cos(latN * Math.PI / 180)))

  const nearbyPlatforms = all
    .filter(s => Math.abs(s.stopLat - latN) <= latDelta && Math.abs(s.stopLon - lonN) <= lonDelta)
    .map(s => ({ ...s, distanceM: Math.round(haversine(latN, lonN, s.stopLat, s.stopLon)) }))
    .filter(s => s.distanceM <= radiusN)
    .sort((a, b) => a.distanceM - b.distanceM)

  // A physical station often has one GTFS platform per direction. Keep the
  // closest platform as the selectable representative so duplicate directions
  // do not consume the requested station limit.
  //
  // Routes and modes are unioned across every platform of the station: a
  // tram/bus interchange must not be labelled tram-only just because its
  // closest platform is the tram one. The mobile transport filter reads
  // `modes`, so a row without it would be dropped by the client.
  const stationsByKey = new Map<string, {
    stop: typeof nearbyPlatforms[number]
    routes: Set<string>
    modes: Set<string>
  }>()

  for (const platform of nearbyPlatforms) {
    const normalizedName = platform.stopName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('fr')
      .trim()
    const key = platform.parentStation || normalizedName

    const entry = stationsByKey.get(key)
      ?? { stop: platform, routes: new Set<string>(), modes: new Set<string>() }

    const membership = membershipByStop.get(platform.stopId)
    for (const route of membership?.routes ?? []) entry.routes.add(route)
    for (const mode of membership?.modes ?? []) entry.modes.add(mode)

    stationsByKey.set(key, entry)
  }

  return [...stationsByKey.values()].slice(0, limitN).map(entry => ({
    ...entry.stop,
    routes: [...entry.routes],
    modes: [...entry.modes],
  }))
})
