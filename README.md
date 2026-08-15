# CTS Tracker Strasbourg

Real-time tram & bus tracker for the Strasbourg CTS network.

**Stack:** Nuxt 4 · Vuetify 4 · MapLibre GL JS · PostgreSQL + Drizzle ORM · SSE · PWA

## Architecture

```
Static GTFS → PostgreSQL/Drizzle
CTS SIRI API → Nitro poller → Normalized cache → SSE stream
                                                 → REST snapshots
Nuxt web app ← SSE/REST
```

### Frontend architecture

One sentence to remember: **components are dumb, composables own behavior,
utils are pure** (see [CONTRIBUTING.md](./CONTRIBUTING.md)).

```
              ┌───────────────────────────────────────┐
              │        pages/index.vue (layout + wiring)      │
              └─────────────────────┬─────────────────┘
                     props ↓            ↑ events
┌───────────────────────────────────────────────────────────┐
│  components/ (dumb, presentational)                          │
│  map/  stops/  ui/  vehicles/ — props in, events out         │
│  Orchestrator exceptions: MapView, AppDrawer, StopSheet      │
└───────────────────────────────┬─────────────────────────┘
                                 │ use…()
┌───────────────────────────────┴─────────────────────────┐
│  composables/ (behavior + side effects)                      │
│  useMapInstance · useMapFraming · useNetworkLayers · …        │
│  attach(map) / detach() pattern for every MapLibre layer     │
└───────┬────────────────────────────────────┬───────────┘
        │ read/write state                       │ addLayer/addSource
┌───────┴─────────────────┐          ┌──────┴────────────────┐
│  stores/ (Pinia state)    │          │  MapLibre GL map layers  │
│  map · stops · lines ·    │          │  clusters · routes ·      │
│  vehicles · favoriteGroups│          │  vehicles · markers      │
└─────────────────────────┘          └───────────────────────┘
              ↑
┌───────────┴──────────────────────────────────────────────┐
│  utils/ (pure functions — no Vue, no stores, 100% testable)  │
│  format · geojson · map-layers · map-constants ·              │
│  connection-status · stopSearch                               │
└───────────────────────────────────────────────────────────┘
```

### Folder conventions

| Folder | Role | Rule of thumb |
|--------|------|---------------|
| `app/pages/` | Layout + wiring only | No business logic |
| `app/components/` | Presentational UI | Props in, events out, no store access (orchestrators excepted) |
| `app/composables/` | Behavior + side effects | Map layers follow the `attach(map)` / `detach()` pattern |
| `app/stores/` | Shared Pinia state | The only place state is mutated |
| `app/utils/` | Pure functions | No Vue, no stores — every function unit-tested |
| `shared/` | Types + Zod schemas | Shared by client and server |
| `server/api/` | Nitro REST/SSE handlers | Thin: validate → delegate to services |
| `server/services/` | Server domain logic | realtime/ (SIRI) and simulation/ (GTFS) |
| `tests/unit/` | Vitest suites | `components/` subfolder uses happy-dom |
| `tests/e2e/` | Playwright suites | smoke + regression |

## Quick start

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment
cp .env.example .env
# Edit .env — set DATABASE_URL

# 3. Run database migrations
pnpm db:generate
pnpm db:migrate

# 4. Download GTFS from https://transport.data.gouv.fr (search "CTS Strasbourg")
#    Place zip in data/gtfs/cts-gtfs.zip
pnpm gtfs:import

# 5. Start dev server
pnpm dev
```

## Milestones

| # | Milestone | Status |
|---|-----------|--------|
| 1 | Static network map (GTFS, stops, line filters, search) | ✅ Done |
| 2 | Animated vehicles from schedule simulation | 🛠️ In progress |
| 3 | CTS SIRI realtime — live positions via SSE | ⏳ Pending CTS token |
| 4 | Polish — dark mode, PWA, French i18n, release | ⏳ Pending |

See [CHECKLIST.md](./CHECKLIST.md) for the detailed phase-by-phase checklist (updated after every commit).

## Data sources

- **GTFS static:** [transport.data.gouv.fr](https://transport.data.gouv.fr) → search "CTS Strasbourg"
- **Real-time SIRI:** [api.cts-strasbourg.eu](https://api.cts-strasbourg.eu) — token required
- **Map tiles:** [OpenFreeMap](https://openfreemap.org) (dev) / Protomaps PMTiles (prod)

## Branch strategy

- `master` — stable releases
- `start-dev` — active development
