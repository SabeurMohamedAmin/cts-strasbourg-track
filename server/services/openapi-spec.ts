/**
 * The OpenAPI 3 spec for the public v1 API, as a plain JS object.
 *
 * Served by GET /api/v1/openapi.json (server/api/openapi.json.get.ts).
 * Kept in sync with docs/openapi.yaml — the YAML is the human-readable
 * source, this object is the machine-served copy. Update both together.
 *
 * Frozen with v1 (ROADMAP_NITRO_API 2.7): only change when the contract does.
 */

const error = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
})

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Strasbourg Bus-Trams Live — Public API',
    version: '1.0.0',
    description:
      'Frozen v1 contract for the Strasbourg transit backend, consumed by the Nuxt web app '
      + 'and the Flutter mobile app. Times are ISO 8601 (Europe/Paris); colors are hex without "#"; '
      + 'mode is "tram"|"bus"; status is "live"|"estimated"|"scheduled"; errors use { statusCode, code, message }. '
      + 'Never break v1: breaking changes ship as /api/v2.',
  },
  servers: [{ url: '/api/v1' }],
  tags: [
    { name: 'stops' }, { name: 'vehicles' }, { name: 'routes' },
    { name: 'stations' }, { name: 'misc' }, { name: 'content' }, { name: 'mobile' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['misc'], summary: 'Liveness/readiness probe (db + CTS poller)',
        responses: { 200: { description: 'Health status', content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthStatus' } } } } },
      },
    },
    '/openapi.json': {
      get: { tags: ['misc'], summary: 'This OpenAPI document, as JSON', responses: { 200: { description: 'OpenAPI 3 spec' } } },
    },
    '/stops': {
      get: {
        tags: ['stops'], summary: 'Every stop or station, with derived line/mode membership',
        parameters: [{ name: 'type', in: 'query', schema: { type: 'string', enum: ['station'] } }],
        responses: { 200: { description: 'List of stops', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/StopWithMembership' } } } } } },
      },
    },
    '/stops/{id}': {
      get: {
        tags: ['stops'], summary: 'One raw stop row by GTFS stop_id',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'The stop', content: { 'application/json': { schema: { $ref: '#/components/schemas/Stop' } } } },
          400: error('Bad request'), 404: error('Not found'),
        },
      },
    },
    '/stops/{id}/arrivals': {
      get: {
        tags: ['stops'], summary: 'Next departures at a station (live + scheduled merge)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10, minimum: 1, maximum: 30 } },
          { name: 'window', in: 'query', schema: { type: 'integer', default: 90, minimum: 1, maximum: 240 } },
        ],
        responses: {
          200: { description: 'Merged arrivals', content: { 'application/json': { schema: { $ref: '#/components/schemas/StopArrivalsResponse' } } } },
          400: error('Bad request'), 404: error('Not found'),
        },
      },
    },
    '/stops/{id}/next-departures': {
      get: {
        tags: ['mobile'], summary: 'Tiny next-departures payload for a home-screen widget',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 3, minimum: 1, maximum: 5 } },
        ],
        responses: {
          200: { description: 'Compact departures', content: { 'application/json': { schema: { $ref: '#/components/schemas/NextDeparturesResponse' } } } },
          400: error('Bad request'), 404: error('Not found'),
        },
      },
    },
    '/stops/arrivals': {
      get: {
        tags: ['stops'], summary: 'Batch arrivals for many stops (favorites)',
        parameters: [
          { name: 'ids', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 4, minimum: 1, maximum: 30 } },
          { name: 'window', in: 'query', schema: { type: 'integer', default: 90, minimum: 1, maximum: 240 } },
        ],
        responses: { 200: { description: 'Map of stopId to arrivals', content: { 'application/json': { schema: { type: 'object' } } } }, 400: error('Bad request') },
      },
    },
    '/stops/nearby': {
      get: {
        tags: ['stops'], summary: 'Nearest stations to a coordinate',
        parameters: [
          { name: 'lat', in: 'query', required: true, schema: { type: 'number', minimum: -90, maximum: 90 } },
          { name: 'lon', in: 'query', required: true, schema: { type: 'number', minimum: -180, maximum: 180 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 5, minimum: 1, maximum: 20 } },
          { name: 'radius', in: 'query', schema: { type: 'number', default: 1000, minimum: 50, maximum: 20000 } },
        ],
        responses: { 200: { description: 'Stops sorted by distance', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/NearbyStop' } } } } }, 400: error('Bad request') },
      },
    },
    '/vehicles': {
      get: {
        tags: ['vehicles'], summary: 'REST fallback returning the latest vehicle snapshot',
        responses: { 200: { description: 'Vehicle snapshot', content: { 'application/json': { schema: { $ref: '#/components/schemas/VehicleSnapshot' } } } } },
      },
    },
    '/stream/vehicles': {
      get: {
        tags: ['vehicles'],
        summary: 'SSE stream of vehicle snapshots + heartbeats',
        description: 'event: vehicles carries a VehicleSnapshot (full replacement); event: heartbeat every 20 s; reconnect with Last-Event-ID.',
        responses: { 200: { description: 'text/event-stream', content: { 'text/event-stream': {} } } },
      },
    },
    '/routes': {
      get: {
        tags: ['routes'], summary: 'All GTFS routes, ordered by short name',
        responses: { 200: { description: 'Route list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Route' } } } } }, 503: error('Database unavailable') },
      },
    },
    '/routes/{id}/shape': {
      get: {
        tags: ['routes'], summary: 'Geometry of one GTFS shape (id is a shape_id)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'GeoJSON Feature<LineString>', content: { 'application/json': { schema: { $ref: '#/components/schemas/ShapeFeature' } } } }, 400: error('Bad request') },
      },
    },
    '/routes/shapes': {
      get: {
        tags: ['routes'], summary: 'Complete map geometry, one MultiLineString per route',
        responses: { 200: { description: 'Route geometries', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/RouteShape' } } } } }, 503: error('Database unavailable') },
      },
    },
    '/stations/{slug}/schedule': {
      get: {
        tags: ['stations'], summary: 'Full-day theoretical timetable of a station (by slug)',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Station timetable', content: { 'application/json': { schema: { $ref: '#/components/schemas/StopScheduleResponse' } } } }, 400: error('Bad request'), 404: error('Not found') },
      },
    },
    '/geocode': {
      get: {
        tags: ['misc'], summary: 'Address search (BAN proxy, biased to Strasbourg)',
        parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Geocode results', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/GeocodeResult' } } } } }, 502: error('Upstream geocoder failure') },
      },
    },
    '/eurometropole/bounds': {
      get: {
        tags: ['misc'], summary: 'Authoritative max zoom-out map frame',
        responses: { 200: { description: 'Bounding box', content: { 'application/json': { schema: { $ref: '#/components/schemas/Bounds' } } } } },
      },
    },
    '/blog': {
      get: {
        tags: ['content'], summary: 'Every published article, most recent first',
        parameters: [{ name: 'locale', in: 'query', schema: { type: 'string', default: 'fr' } }],
        responses: { 200: { description: 'Article summaries', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/BlogArticleSummary' } } } } } },
      },
    },
    '/blog/{slug}': {
      get: {
        tags: ['content'], summary: 'One full published article',
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locale', in: 'query', schema: { type: 'string', default: 'fr' } },
        ],
        responses: { 200: { description: 'Article detail with neighbours', content: { 'application/json': { schema: { $ref: '#/components/schemas/BlogArticleResponse' } } } }, 404: error('Not found') },
      },
    },
    '/disruptions': {
      get: {
        tags: ['mobile'], summary: 'Current and upcoming service disruptions',
        responses: { 200: { description: 'Disruption list (critical first)', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Disruption' } } } } } },
      },
    },
    '/devices': {
      post: {
        tags: ['mobile'], summary: 'Register a device for push alerts (idempotent)',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DeviceRegistration' } } } },
        responses: { 201: { description: 'Device registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/DeviceRegistered' } } } }, 400: error('Bad request') },
      },
    },
    '/track': {
      post: {
        tags: ['mobile'], summary: 'Accept a product analytics event',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TrackEvent' } } } },
        responses: { 202: { description: 'Event accepted', content: { 'application/json': { schema: { $ref: '#/components/schemas/TrackAccepted' } } } }, 400: error('Bad request') },
      },
    },
  },
  components: {
    schemas: {
      ApiError: {
        type: 'object',
        properties: { statusCode: { type: 'integer' }, code: { type: 'string' }, message: { type: 'string' } },
        required: ['statusCode', 'code', 'message'],
      },
      HealthStatus: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok', 'degraded'] },
          time: { type: 'string', format: 'date-time' },
          checks: {
            type: 'object',
            properties: {
              database: { type: 'string', enum: ['up', 'down'] },
              ctsPoller: { type: 'string', enum: ['live', 'stale', 'disabled'] },
            },
          },
        },
      },
      Stop: {
        type: 'object',
        properties: {
          stopId: { type: 'string' }, stopCode: { type: 'string', nullable: true },
          stopName: { type: 'string' }, stopLat: { type: 'number' }, stopLon: { type: 'number' },
          locationType: { type: 'integer' }, parentStation: { type: 'string', nullable: true },
          wheelchairBoarding: { type: 'integer' }, platformCode: { type: 'string', nullable: true },
        },
      },
      StopWithMembership: {
        allOf: [
          { $ref: '#/components/schemas/Stop' },
          { type: 'object', properties: { routes: { type: 'array', items: { type: 'string' } }, modes: { type: 'array', items: { type: 'string', enum: ['tram', 'bus'] } } } },
        ],
      },
      NearbyStop: {
        allOf: [
          { $ref: '#/components/schemas/Stop' },
          { type: 'object', properties: { distanceM: { type: 'number' } } },
        ],
      },
      StopArrival: {
        type: 'object',
        properties: {
          tripId: { type: 'string' }, lineLabel: { type: 'string' }, destination: { type: 'string' },
          scheduledArrival: { type: 'string', format: 'date-time' },
          mode: { type: 'string', enum: ['bus', 'tram'] },
          routeColor: { type: 'string' }, routeTextColor: { type: 'string' },
          status: { type: 'string', enum: ['live', 'estimated', 'scheduled'] },
        },
      },
      StopServedLine: {
        type: 'object',
        properties: {
          routeId: { type: 'string' }, lineLabel: { type: 'string' },
          mode: { type: 'string', enum: ['bus', 'tram'] },
          routeColor: { type: 'string' }, routeTextColor: { type: 'string' },
        },
      },
      StopArrivalsResponse: {
        type: 'object',
        properties: {
          stopId: { type: 'string' }, stopName: { type: 'string' },
          servedLines: { type: 'array', items: { $ref: '#/components/schemas/StopServedLine' } },
          arrivals: { type: 'array', items: { $ref: '#/components/schemas/StopArrival' } },
        },
      },
      NextDeparture: {
        type: 'object',
        properties: {
          lineLabel: { type: 'string' }, destination: { type: 'string' },
          departure: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['live', 'estimated', 'scheduled'] },
          routeColor: { type: 'string' }, routeTextColor: { type: 'string' },
        },
      },
      NextDeparturesResponse: {
        type: 'object',
        properties: {
          stopId: { type: 'string' }, stopName: { type: 'string' },
          departures: { type: 'array', items: { $ref: '#/components/schemas/NextDeparture' } },
        },
      },
      LiveVehicle: {
        type: 'object',
        properties: {
          id: { type: 'string' }, mode: { type: 'string', enum: ['bus', 'tram'] },
          lineId: { type: 'string' }, lineLabel: { type: 'string' }, destination: { type: 'string' },
          latitude: { type: 'number' }, longitude: { type: 'number' },
          bearing: { type: 'number' }, delaySeconds: { type: 'number' },
          status: { type: 'string', enum: ['live', 'estimated', 'scheduled'] },
          recordedAt: { type: 'string', format: 'date-time' },
        },
      },
      VehicleSnapshot: {
        type: 'object',
        properties: {
          freshness: { type: 'string', enum: ['live', 'stale'] },
          recordedAt: { type: 'string', format: 'date-time' },
          lastSuccessfulUpdate: { type: 'string', format: 'date-time' },
          vehicles: { type: 'array', items: { $ref: '#/components/schemas/LiveVehicle' } },
        },
      },
      Route: {
        type: 'object',
        properties: {
          routeId: { type: 'string' }, routeShortName: { type: 'string' }, routeLongName: { type: 'string' },
          routeType: { type: 'integer' }, routeColor: { type: 'string' }, routeTextColor: { type: 'string' },
        },
      },
      ShapeFeature: {
        type: 'object',
        properties: { type: { type: 'string', enum: ['Feature'] }, properties: { type: 'object' }, geometry: { type: 'object' } },
      },
      RouteShape: {
        type: 'object',
        properties: { routeId: { type: 'string' }, routeColor: { type: 'string' }, geometry: { type: 'object' } },
      },
      StopScheduleResponse: {
        type: 'object',
        properties: {
          slug: { type: 'string' }, stopId: { type: 'string' }, stopName: { type: 'string' },
          date: { type: 'string' }, lines: { type: 'array', items: { type: 'object' } },
        },
      },
      GeocodeResult: {
        type: 'object',
        properties: {
          id: { type: 'string' }, label: { type: 'string' }, context: { type: 'string' },
          type: { type: 'string', enum: ['housenumber', 'street', 'locality', 'municipality'] },
          lat: { type: 'number' }, lon: { type: 'number' },
        },
      },
      Bounds: {
        type: 'object',
        properties: { bounds: { type: 'array', items: { type: 'array', items: { type: 'number' } } } },
      },
      BlogArticleSummary: {
        type: 'object',
        properties: {
          id: { type: 'integer' }, slug: { type: 'string' }, title: { type: 'string' }, excerpt: { type: 'string' },
          date: { type: 'string' }, readingMinutes: { type: 'integer' },
          lines: { type: 'array', items: { type: 'string' } }, nearestStop: { type: 'string' }, image: { type: 'string' },
        },
      },
      BlogArticleResponse: {
        type: 'object',
        properties: { article: { type: 'object' }, previous: { type: 'object', nullable: true }, next: { type: 'object', nullable: true } },
      },
      Disruption: {
        type: 'object',
        properties: {
          id: { type: 'integer' }, title: { type: 'string' }, description: { type: 'string' },
          severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
          lineIds: { type: 'array', items: { type: 'string' } }, stopIds: { type: 'array', items: { type: 'string' } },
          startsAt: { type: 'string', format: 'date-time' }, endsAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      DeviceRegistration: {
        type: 'object', required: ['fcmToken', 'platform'],
        properties: {
          fcmToken: { type: 'string' }, platform: { type: 'string', enum: ['android', 'ios'] },
          favoriteLineIds: { type: 'array', items: { type: 'string' } },
        },
      },
      DeviceRegistered: {
        type: 'object',
        properties: { id: { type: 'integer' }, ok: { type: 'boolean' } },
      },
      TrackEvent: {
        type: 'object', required: ['event', 'platform'],
        properties: {
          event: { type: 'string' }, platform: { type: 'string', enum: ['web', 'android', 'ios'] },
          properties: { type: 'object' },
        },
      },
      TrackAccepted: {
        type: 'object',
        properties: { ok: { type: 'boolean' } },
      },
    },
  },
} as const
