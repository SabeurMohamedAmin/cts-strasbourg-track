# Feature Parity Matrix — Web (Nuxt) ↔ Mobile (Flutter) ↔ API

Single source of truth for feature parity between the two clients.
Legend: ✅ done · 🔲 planned · ➖ intentionally absent

| Feature                | API endpoint (v1)             | Web    | Flutter    |
|------------------------|-------------------------------|--------|------------|
| Stop search            | /stops                        | ✅     | 🔲 4.1     |
| Nearby stops (geo)     | /stops/nearby                 | ✅     | 🔲 4.2     |
| Real-time arrivals     | /stops/:id/arrivals           | ✅     | 🔲 4.3     |
| Line detail + shape    | /routes, /routes/:id/shape    | ✅     | 🔲 4.4     |
| Live vehicle map       | /stream/vehicles (SSE)        | ✅     | 🔲 4.5–4.6 |
| Favorites (local)      | ➖ local-only in v1           | ✅     | 🔲 4.7     |
| Geocoding              | /geocode                      | ✅     | 🔲 4.2     |
| Station schedule       | /stations/:slug/schedule      | ✅     | 🔲 4.4     |
| Blog                   | /blog, /blog/:slug            | ✅     | 🔲 4.11    |
| Dark mode              | ➖ client-side                | ✅     | 🔲 5.6     |
| Disruption banner      | /disruptions 🔲               | 🔲     | 🔲 5.7     |
| Push notifications     | /devices + FCM 🔲             | 🔲 2.5 | 🔲 5.2     |
| Next-departures widget | /stops/:id/next-departures 🔲 | ➖     | 🔲 5.3     |
| Deep links (slugs)     | ✅ slug convention            | ✅     | 🔲 5.5     |

Column references: Flutter numbers = ROADMAP_FLUTTER.txt phase items
(Web 2.5 = web push in ROADMAP_FLUTTER.txt Phase 2). API 🔲 endpoints =
ROADMAP_NITRO_API.txt Step 8.

**Rule: no feature ships on one client without a 🔲/➖ decision here.**

i18n rule: v1 ships `fr` only on BOTH clients; `en` is added to both
simultaneously later.
