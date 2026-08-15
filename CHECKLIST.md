# CTS Strasbourg Tracker — Build Checklist

A phase-by-phase log.  Each phase is marked ✅ when code is merged, 🔄 when in progress, ⬜ when not yet started.

---

## Phase A — Scaffold
- ✅ Nuxt 4 + Vuetify 4 + MapLibre GL
- ✅ PWA module configured
- ✅ Drizzle ORM + SQLite
- ✅ `parisClock()` utility (Europe/Paris, service-date aware)

## Phase B — GTFS Ingestion
- ✅ Parse `routes.txt`, `stops.txt`, `shapes.txt`, `trips.txt`, `stop_times.txt`
- ✅ Ingest into SQLite via `scripts/ingest-gtfs.ts`
- ✅ `calendar.txt` + `calendar_dates.txt` → active service IDs

## Phase C — Static Map
- ✅ All lines drawn with official CTS colors
- ✅ Stop markers as tappable circles (clustered below zoom 14)
- ✅ Route visibility toggled by the line filter panel
- ✅ OpenFreeMap Liberty style + glyph CDN fix
- ✅ Fallback sprite images registered (no console 404s)

## Phase D — Schedule Cache
- ✅ In-memory `getDaySchedule()` — trips + stop events pre-sorted
- ✅ Midnight invalidation (cache reloaded automatically at service-day change)

## Phase E — SIRI Real-Time (future)
- ⬜ Poll CTS SIRI-SM feed every 30 s
- ⬜ Merge live positions into schedule cache
- ⬜ Upgrade `StopSheet` status chips from `scheduled` → `live`

## Phase F — Simulation
- ✅ Scheduled vehicle positions computed from stop_times
- ✅ Overnight trips (GTFS times > 86 400 s) handled correctly
- ✅ `positionForTrip()` — linear interpolation between stop events
- ✅ Simulation clock advances in real time via `parisClock()`

## Phase G — Vehicle Layer (MapLibre)
- ✅ ONE GeoJSON source — no DOM markers
- ✅ ONE rAF tween loop — no teleporting
- ✅ Tab-visibility pause/resume (whole-machine-freeze fix)
- ✅ Movement threshold dirty-check (skip GPU upload when nothing moved)
- ✅ Bearing direction arrow (`▲` rotated to heading)
- ✅ Mode-aware SDF icons: tram (rectangular + roof bar) vs bus (pill)
- ✅ Selected vehicle gets larger circle ring
- ✅ `useVehicleLayer` composable wired to `MapView`

## Phase H — Line Filter Panel
- ✅ `LinesPanel` — toggle visibility per route
- ✅ Vuetify drawer on desktop, bottom sheet on mobile

## Phase I — SSE Live Feed
- ✅ `/api/live/vehicles` SSE endpoint with `id:` event field
- ✅ Server-side ring buffer for `Last-Event-ID` replay
- ✅ `useSseClient` composable — auto-reconnect with exponential back-off
- ✅ `Last-Event-ID` sent automatically by browser `EventSource` spec
- ✅ Visibility-aware reconnect (deferred while tab is hidden)

## Phase J — PWA & Offline
- ⬜ Service worker pre-caches map tiles for Strasbourg bounding box
- ⬜ Offline banner when SSE connection is lost
- ⬜ Background sync when connection is restored

## Phase K — Favourites
- ✅ Add / remove favourite stops via `StopSheet` star button
- ✅ Favourites listed first in `StopSearch`
- ✅ Clear-all favourites button in `StopSearch`
- ✅ Favourite stops shown with gold ring on the map
- ✅ `hydrateFavorites()` called on mount

## Phase L — Stop Detail
- ✅ `StopSheet` — upcoming departures with line badge, destination, time
- ✅ Distance from user (when geolocation active)
- ✅ Loading skeletons (4 rows while fetching)
- ✅ Empty state (no departures in next 90 min)
- ✅ Status chip: Théorique / Estimé / Temps réel
- ✅ Auto-refresh every 30 s via `useStopArrivals`
- ✅ `/api/stops/:id/arrivals` endpoint (overnight-trip aware)

## Phase M — Vehicle Detail
- ✅ `VehicleSheet` — line badge, destination, bearing arrow
- ✅ Status chip: Théorique / Estimé / Temps réel
- ✅ Next stop + expected arrival
- ✅ Delay readout (hidden when status is `scheduled`)
- ✅ Bearing in degrees + 8-point cardinal direction (French labels)
- ✅ Last-updated timestamp

---

## Known Gaps / Next Steps

| Item | Priority | Notes |
|------|----------|-------|
| Phase E — SIRI real-time | High | CTS API access required |
| Phase J — PWA offline | Medium | tile-cache strategy TBD |
| Stop name labels on map (zoom ≥ 15) | Low | symbol layer, clutter management needed |
| Journey planner (A→B routing) | Low | out of MVP scope |
