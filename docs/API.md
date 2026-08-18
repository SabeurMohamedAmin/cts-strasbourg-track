# API Contract — Strasbourg Transit Backend

> **Status: FROZEN (2026-07-24).** This document is the integration spec for the
> future Flutter client. Do **not** change any endpoint (URL, params, response
> shape) without introducing versioning (see ROADMAP_FIXES.txt #12).
>
> Source of truth: `server/api/**/*.ts` and `shared/types/*.ts`.

## Conventions

- Every endpoint is also reachable under the `/api/v1/` prefix (server-side
  alias to the same handlers). **New clients should call `/api/v1/…`**: a
  future breaking change will ship as `/api/v2/` while v1 keeps working.
- The admin area is **not** part of v1: `/api/v1/admin/**` always returns
  `404`. Admin endpoints exist only unversioned under `/api/admin/**`,
  behind session auth.
- Responses served through the `/api/v1/` prefix carry an
  `X-API-Version: 1` header.
- All endpoints are `GET` and return JSON, except the SSE stream.
- Times are ISO 8601 strings; the service timezone is `Europe/Paris`.
- Colors (`routeColor`, `routeTextColor`) are hex strings **without** the leading `#`.
- Errors use the Nuxt/Nitro shape: `{ "statusCode": number, "message": string }`.
- `mode` is always `"tram"` or `"bus"`; `status` is `"live" | "estimated" | "scheduled"`.

### Shared shapes (from `shared/types/`)

```ts
interface StopArrival {
  tripId: string            // GTFS trip ID (SIRI journeyRef for live entries)
  lineLabel: string         // "A", "C6", ...
  destination: string       // headsign
  scheduledArrival: string  // ISO 8601
  mode: 'bus' | 'tram'
  routeColor: string        // hex without '#'
  routeTextColor: string    // hex without '#'
  status: 'live' | 'estimated' | 'scheduled'
}

interface StopServedLine {
  routeId: string
  lineLabel: string
  mode: 'bus' | 'tram'
  routeColor: string
  routeTextColor: string
}

interface StopArrivalsResponse {
  stopId: string
  stopName: string
  servedLines: StopServedLine[]
  arrivals: StopArrival[]
}

interface LiveVehicle {
  id: string
  mode: 'bus' | 'tram'
  lineId: string
  lineLabel: string
  destination: string
  latitude: number
  longitude: number
  bearing?: number
  delaySeconds?: number
  status: 'live' | 'estimated' | 'scheduled'
  nextStop?: { id: string, name: string, expectedArrival?: string }
  recordedAt: string          // ISO 8601
  shapePath?: [number, number][]   // [lon, lat]; omitted for live vehicles
  pathAhead?: [number, number][]   // [lon, lat]; omitted while dwelling
}

interface VehicleSnapshot {
  freshness: 'live' | 'stale'
  recordedAt: string
  lastSuccessfulUpdate?: string
  vehicles: LiveVehicle[]
}

// Stop row (GTFS `stops` table)
interface Stop {
  stopId: string            // GTFS stop_id, e.g. "23NOV_01"
  stopCode: string | null   // CTS SIRI MonitoringRef, e.g. "704A"
  stopName: string
  stopLat: number
  stopLon: number
  locationType: number      // 0 = platform, 1 = station
  parentStation: string | null
  wheelchairBoarding: number
  platformCode: string | null
}
```

---

## Stops

### GET `/api/stops`

Every stop (or station) of the network, with derived line/mode membership.

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `type` | `"station"` \| other | platforms | `station` returns `location_type = 1` rows; anything else returns platforms (`location_type = 0`) |

**Response** `200`: `Array<Stop & { routes: string[], modes: ('tram'|'bus')[] }>`

Caching: `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`;
also cached in server memory until restart.

### GET `/api/stops/:id`

One raw stop row by GTFS `stop_id`.

**Response** `200`: `Stop` — **Errors**: `400` missing id, `404` unknown stop.

### GET `/api/stops/:id/arrivals`

Next departures at a station, merging CTS SIRI real time (status `live`) with
the GTFS schedule (status `scheduled`). Sibling platforms of the same physical
station are aggregated. Live data has a 500 ms budget: past it, scheduled
times are returned and live values appear on a later poll (clients poll every
30 s).

| Param | Type | Default | Bounds | Notes |
|-------|------|---------|--------|-------|
| `limit` | int | 10 | 1–30 | at least one slot per active line is always kept |
| `window` | int (minutes) | 90 | 1–240 | look-ahead window |
| `refresh` / `_t` | any | — | — | truthy value bypasses the server-side SIRI cache |

**Response** `200`: `StopArrivalsResponse` — **Errors**: `400` invalid params, `404` unknown stop.

### GET `/api/stops/arrivals`

Batch variant for the favorites page: one request, many stops.

| Param | Type | Default | Bounds | Notes |
|-------|------|---------|--------|-------|
| `ids` | string | required | max 50 ids | comma-separated GTFS stop ids |
| `limit` | int | 4 | 1–30 | per stop |
| `window` | int (minutes) | 90 | 1–240 | |
| `refresh` / `_t` | any | — | — | bypasses the 20 s response cache |

**Response** `200`: `Record<stopId, StopArrivalsResponse | null>` — `null` when
that stop's fetch failed. **Errors**: `400` missing `ids` or more than 50 ids.

Caching: `Cache-Control: private, max-age=15, stale-while-revalidate=30` + 20 s server memory cache.

### GET `/api/stops/nearby`

Nearest stations to a coordinate. One representative platform per physical
station (closest one), so directions do not consume the limit.

| Param | Type | Default | Bounds |
|-------|------|---------|--------|
| `lat` | float | required | −90…90 |
| `lon` | float | required | −180…180 |
| `limit` | int | 5 | 1–20 |
| `radius` | float (metres) | 1000 | 50–20000 |

**Response** `200`: `Array<Stop & { distanceM: number }>` sorted by distance.
**Errors**: `400` missing/invalid coordinates.

---

## Vehicles

### GET `/api/stream/vehicles` (SSE)

Server-Sent Events stream of vehicle snapshots.

- `event: vehicles` — `data`: `VehicleSnapshot` JSON. Sent on connect, then on
  every tick (`pollIntervalMs`, default 12 s). Each snapshot **fully replaces**
  the previous vehicle list.
- `event: heartbeat` — `data`: `{ "time": ISO8601 }`, every 20 s.
- Events carry an `id:`; reconnecting with `Last-Event-ID` replays missed
  snapshots from the in-memory buffer.
- Live CTS data is the single source of truth when fresh; a GTFS-simulated
  snapshot (status `scheduled`) is streamed **only** when live data is
  entirely unavailable. The two are never mixed.

### GET `/api/vehicles`

REST fallback returning the same payload as one SSE frame.

**Response** `200`: `VehicleSnapshot`. Never fails: when both live data and the
database are unavailable it degrades to `{ freshness: 'stale', vehicles: [] }`.

---

## Routes

### GET `/api/routes`

All GTFS routes, ordered by short name.

**Response** `200`:
`Array<{ routeId, routeShortName, routeLongName, routeType, routeColor, routeTextColor }>`
(`routeType`: 0 = tram, 3 = bus; colors default to `c8102e` / `ffffff`).
**Errors**: `503` database unreachable.

### GET `/api/routes/:id/shape`

Geometry of **one GTFS shape**. Note: `:id` is a GTFS `shape_id`, not a route id.

**Response** `200`: GeoJSON `Feature<LineString>` with `properties: { shapeId }`
and `[lon, lat]` coordinates. An unknown id yields an empty coordinates array.
**Errors**: `400` missing id.

### GET `/api/routes/shapes`

Complete map geometry for every route, one `MultiLineString` per route. Falls
back to straight lines between ordered stops when the feed ships no shapes.

**Response** `200`:
`Array<{ routeId, routeColor, geometry: MultiLineString }>` — **Errors**: `503` database unreachable.

---

## Stations

### GET `/api/stations/:slug/schedule`

Full-day theoretical timetable of a station, addressed by its URL slug
(e.g. `cite-de-l-ill`). Grouped by line → GTFS `direction_id` → hour.

**Response** `200` (`StopScheduleResponse` from `shared/types/schedule.ts`):

```ts
interface StopScheduleResponse {
  slug: string
  stopId: string      // primary platform — reuse for /arrivals and favourites
  stopName: string
  date: string        // service date, YYYY-MM-DD (Europe/Paris)
  lines: Array<{
    routeId: string
    lineLabel: string
    mode: 'bus' | 'tram'
    routeColor: string
    routeTextColor: string
    directions: Array<{
      directionId: number     // 0 = outbound, 1 = return
      headsign: string        // most frequent terminus label
      headsigns: string[]     // every terminus served
      hours: Array<{ hour: number, minutes: number[] }>  // hour may be 24/25; display hour % 24
    }>
  }>
}
```

**Errors**: `400` missing slug, `404` unknown station.

---

## Misc

### GET `/api/geocode`

Address search proxied to the French BAN API, biased to Strasbourg and
hard-filtered to the Eurométropole bounding box.

| Param | Type | Notes |
|-------|------|-------|
| `q` | string | free text; fewer than 3 characters returns `[]` |

**Response** `200`: `GeocodeResult[]`

```ts
interface GeocodeResult {
  id: string        // stable BAN id
  label: string     // "12 Rue du Faubourg National 67000 Strasbourg"
  context: string   // "67000 Strasbourg"
  type: 'housenumber' | 'street' | 'locality' | 'municipality'
  lat: number
  lon: number
}
```

**Errors**: `502` upstream BAN failure. Caching: `Cache-Control: public, max-age=600` + 10 min server cache.

### GET `/api/eurometropole/bounds`

Authoritative max zoom-out frame for the map.

**Response** `200`: `{ bounds: [[swLon, swLat], [neLon, neLat]] }` — never fails (static data).
