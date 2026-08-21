=== Backend Analytics Dashboard — Implementation Checklist ===
Created: 2026-07-24
Status tracking: [ ] Not started  [/] In progress  [x] Done
Priority: P0 = decisions (blockers)  P1 = collection (M1)  P2 = aggregation + minimal dashboard (M2)
          P3 = realtime + insights (M3)  P4 = system health + extras (M4)

-----------------------------------------------
P0 — FOUNDATIONS & DECISIONS (do first, 1–2 days)
-----------------------------------------------
[ ] 1. DEFINE TRACKED METRICS
      Decision needed: final list of metrics.
      Candidates: page views, unique visitors, API endpoint usage,
        geolocation opt-in rate (granted / skipped / never), popular
        stops/lines, PWA installs, SSE connection count.
      Action: Write the chosen list in the NOTES section below.
      Verify: Every metric has a source event type in item 5's schema.

[ ] 2. PRIVACY MODEL — COOKIELESS (GDPR, French audience)
      Action: Anonymize visitors with sha256(ip + userAgent + dailySalt).
        NEVER store raw IPs. No cookies — no consent banner needed
        (Plausible-style). Country/city optional, derived from IP BEFORE
        the IP is discarded.
      Verify: grep the analytics code — no raw IP ever written to DB.

[ ] 3. ADMIN AUTH STRATEGY
      Package: nuxt-auth-utils (sealed session cookies, no external service)
      File: nuxt.config.ts (runtimeConfig.adminPassword — env NUXT_ADMIN_PASSWORD)
      Action: Single admin password for now; roles later if ever needed.
      Verify: .env.example documents NUXT_ADMIN_PASSWORD with placeholder.

[ ] 4. RETENTION POLICY DECISION
      Proposed: raw events 90 days, aggregates kept forever.
      Action: Confirm and record in NOTES; used by purge task (item 9).
      Verify: Value in NOTES matches the purge task constant.

-----------------------------------------------
P1 — M1: DATA COLLECTION LAYER (~3 days)
-----------------------------------------------
[ ] 5. DRIZZLE SCHEMA — analytics tables
      File: server/database/schema/analytics.ts (new)
      Tables:
        - events: id, type ('pageview' | 'api_call' | 'geo_granted' |
          'geo_skipped' | 'geo_never' | ...), path, visitorHash, referrer,
          device (mobile/desktop from UA), platform ('web' | 'android' |
          'ios'), country (optional), createdAt
        - daily_stats: date, metric, dimension
          (e.g. 'path:/station/homme-de-fer'), count
      Indexes (DAY ONE, or rollups will crawl):
        - events(createdAt, type)
        - daily_stats UNIQUE (date, metric, dimension)
      Action: Generate migration via existing server/database/migrations flow.
      Verify: Migration applies cleanly on a fresh DB.

[ ] 6. NITRO SERVER MIDDLEWARE — API call tracking
      File: server/middleware/analytics.ts (new)
      Requirements:
        - Filter noise: assets, bot UAs, /admin, /api/admin
        - Fire-and-forget: NEVER await inside the request hot path;
          buffer in memory, flush every 5 s as ONE batch insert
        - Do NOT track the CTS polling loop (server would count itself)
      Verify: Response latency unchanged with tracking on (compare p95);
              poller requests absent from events table.

[ ] 7. CLIENT PAGEVIEW BEACON + CUSTOM EVENTS
      File: app/composables/useAnalytics.ts (new)
      File: server/api/track.post.ts (new)
      Requirements:
        - navigator.sendBeacon on route change (survives tab close)
        - Custom events: geo_granted, geo_skipped, geo_never (wire into the
          home geolocation dialog gate), favorite_added, landmark_clicked
        - /api/track (-> /api/v1/track) also accepts mobile events
          authenticated by X-App-Token, with platform dimension
          web|android|ios (see ROADMAP_NITRO_API 8.7)
      Verify: Events appear in DB while navigating; no console errors;
              beacon fires on tab close (check Network panel type=beacon).

-----------------------------------------------
P2 — M2: AGGREGATION + MINIMAL DASHBOARD (~3 days)
-----------------------------------------------
[ ] 8. SCHEDULED ROLLUP TASK (hourly)
      File: server/tasks/analytics-rollup.ts (new)
      File: nuxt.config.ts (nitro.scheduledTasks)
      Action: Roll raw events up into daily_stats (visitors, pageviews,
        top paths, top stops, geo opt-in rate, api calls per endpoint).
      Verify: Dashboard queries read daily_stats only — O(days), not O(events).

[ ] 9. SCHEDULED PURGE TASK (daily)
      File: server/tasks/analytics-purge.ts (new)
      Action: Delete raw events older than retention (item 4).
      Verify: Row count drops after task run; aggregates untouched.

[ ] 10. ADMIN AUTH GUARD + OVERVIEW API
      File: server/middleware/admin-auth.ts (new) — protects /api/admin/**
      File: server/api/admin/overview.get.ts (new)
        → today vs yesterday KPIs: visitors, pageviews, geo opt-in %,
          avg response time
      File: server/api/admin/traffic.get.ts (new)
        → time series ?from&to&interval=day|hour
      File: server/api/admin/pages.get.ts (new)
        → top pages/stations ?from&to
      Verify: Unauthenticated request → 401; authenticated → 200 with data.

[ ] 11. MINIMAL DASHBOARD UI — login + KPIs + one chart
      File: app/layouts/admin.vue (new)
      File: app/pages/admin/login.vue (new)
      File: app/pages/admin/index.vue (new) — definePageMeta middleware 'admin'
      Components (Vuetify core, same glass design tokens as the app):
        - KPI row: v-card stat tiles with delta vs previous period
        - Traffic chart: vue-chartjs (Chart.js ~70 kB) inside <ClientOnly>
      Verify: /admin redirects to /admin/login when logged out;
              admin JS chunk NOT loaded on visitor pages (Network panel).

-----------------------------------------------
P3 — M3: REALTIME + INSIGHTS (~3 days)
-----------------------------------------------
[ ] 12. REALTIME PANEL
      File: server/api/admin/realtime.get.ts (new)
      Action: Active visitors (last 5 min) + current SSE connection count
        split by platform (web | android | ios), reusing
        server/services/realtime state; stream over the existing
        SSE pattern (see server/api/stream).
      Verify: Opening the app in a second browser bumps the live counter.

[ ] 13. TOP STATIONS TABLE + DATE PRESETS
      File: app/pages/admin/index.vue (extend)
      Components: v-data-table with search; v-btn-toggle presets 7j/30j/90j.
      Verify: Sorting/search work; range switch refetches.

[ ] 14. GEO FUNNEL WIDGET
      Action: dialog shown → granted vs skipped vs never — validates the
        home-page geolocation gate UX with real numbers.
      Verify: Percentages match raw event counts for the same period.

-----------------------------------------------
P4 — M4: SYSTEM HEALTH + EXTRAS (~2 days, then ongoing)
-----------------------------------------------
[ ] 15. SYSTEM HEALTH ENDPOINT + PANEL
      File: server/api/admin/system.get.ts (new)
      Metrics: CTS API quota usage, poll health, error rate, DB size.
      Note: reuse server/plugins/request-logger.ts (ROADMAP_FIXES item 13)
        as the latency/error data source instead of duplicating it.
      Verify: Panel shows live values; killing the CTS token flips poll health.

[ ] 16. ERROR TRACKING TABLE
      Action: 4xx/5xx per endpoint, CTS API failures, last occurrence.
      Verify: Forcing a 500 in dev shows up within one rollup cycle.

[ ] 17. OPTIONAL / FUTURE
      [ ] Alerting: email/webhook when error rate spikes
      [ ] CSV export of any dashboard table
      [ ] Dynamic "Accès rapide" landmarks fed by popular-stops ranking
      [ ] Geolocation accuracy distribution + time-to-first-departure metric

-----------------------------------------------
DASHBOARD READINESS GATE (before calling it "done")
-----------------------------------------------
[ ] 18. FINAL CHECKLIST (re-verify all at once)
      [ ] No raw IP stored anywhere (item 2)
      [ ] Tracking adds ~0 ms to API responses (item 6)
      [ ] Rollups + purge run automatically (items 8–9)
      [ ] /api/admin/** all return 401 unauthenticated (item 10)
      [ ] Admin chunk absent from visitor bundles (item 11)
      [ ] events(createdAt, type) index present (item 5)
      [ ] Retention constant matches NOTES decision (item 4)

-----------------------------------------------
NOTES / DECISIONS LOG
-----------------------------------------------
Tracked metrics (P0 #1):
  Chosen: (fill after decision)

Retention policy (P0 #4):
  Chosen: raw events ___ days / aggregates forever (proposed: 90 days)
  Confirmed: 2026-___-___

Admin password (P0 #3):
  Env var: NUXT_ADMIN_PASSWORD
  Stored in: production host secret manager (never committed)

Chart library (P2 #11):
  Chosen: vue-chartjs + Chart.js (~70 kB, client-only) — revisit only if
  bundle impact on /admin becomes a problem (it never ships to visitors).
