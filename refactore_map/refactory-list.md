🗺️ Refactoring Roadmap
Phase 0 — Safety Net (do this before touching anything)
Step 0.1 — Freeze current behavior ✅ DONE

 Add a Playwright smoke test: app loads, map canvas appears, drawer opens, a stop can be selected
 Add test and test:e2e scripts to package.json (vitest run, playwright test)
 Run nuxt typecheck and fix/record any pre-existing errors

Step 0.2 — Tooling ✅ DONE

 Add ESLint (@nuxt/eslint) with a shared config; add lint script
 Add a CI pipeline (.gitlab-ci.yml): install → lint → typecheck → unit tests → build
 ✅ Exit criteria: pipeline is green on main — every later step must keep it green


Phase 1 — Extract Pure Logic (zero-risk, instantly testable)
Step 1.1 — Map constants → app/utils/map-constants.ts ✅ DONE

 Move EUROMETROPOLE_BOUNDS (desktop + mobile), STRASBOURG_CENTER, ABSOLUTE_MIN_ZOOM, OFM_GLYPH_FALLBACK, STYLE_RELOAD_DEBOUNCE_MS out of MapView.vue
 Convert the needless computed() wrappers around static bounds into plain const tuples
 MapView.vue imports them; app behaves identically

Step 1.2 — Formatters → app/utils/format.ts ✅ DONE

 Extract from StopSheet.vue: formatTime, relativeArrival, statusChipLabel, statusChipColor, distanceLabel logic, lineStyle
 Write Vitest unit tests for each (edge cases: 0 min, 1 min, <1 km, ≥1 km, each status)

Step 1.3 — GeoJSON builders → app/utils/geojson.ts ✅ DONE

 Extract stopFeatureCollection() as a pure function buildStopFeatureCollection(stops, favoriteIds)
 Unit test: favorites flagged correctly, coordinates in [lon, lat] order

Step 1.4 — Layer specs → app/utils/map-layers.ts ✅ DONE

 Extract the giant inline addLayer option objects (clusters, unclustered stops, selected ring, route line + glow) into named factory functions: stopClusterLayer(), routeLineLayers(routeId, color, visible)
 Unit test: factories return correct ids/filters/visibility
 ✅ Exit criteria: MapView.vue under ~450 lines, first real unit test suite exists, pipeline green


Phase 2 — Extract Map Composables (MapView.vue → orchestrator only)
Step 2.1 — useMapInstance.ts ✅ DONE

 Owns: map creation, controls (nav/geolocate/scale), transformRequest glyph fix, fallback images, onUnmounted cleanup
 Exposes: { map, mapReady, createMap(container), destroyMap() }

Step 2.2 — useMapFraming.ts ✅ DONE

 Owns: responsive bounds computed from useDisplay(), fitEurometropole(), recenter(), the two-guard minZoom/maxBounds logic, breakpoint watcher, prefersReducedMotion
 Unit test the bounds-selection logic (mobile vs desktop)

Step 2.3 — useNetworkLayers.ts ✅ DONE

 Owns: addNetworkLayers, loadNetwork, retryLoad, route visibility watcher, stop source updates, click/hover event bindings
 Exposes: { loading, errorMessage, attach(map), detach(), retry() } — same attach/detach pattern as your existing useVehicleLayer/useTramStopLayer ✅ (consistency for juniors)

Step 2.4 — useStopTooltip.ts and usePlaceMarker.ts ✅ DONE

 Tooltip: single reused popup, XSS-safe textContent — keep that comment
 Place marker: watcher on mapStore.focusedPlace + flyTo

Step 2.5 — useMapThemeSync.ts ✅ DONE

 Owns: isDark(), styleForTheme(), safeOnceStyleLoad, debounced reloadLayersAfterStyleChange, theme watcher
 ✅ Exit criteria: MapView.vue <script> ≈ 60–80 lines wiring composables together; smoke test still passes; theme toggle still rebuilds layers


Phase 3 — Split Presentational Components
Step 3.1 — Map overlays → app/components/map/ ✅ DONE

 MapLoadingOverlay.vue (spinner + copy, props: none)
 MapErrorAlert.vue (props: message; emits: retry, close)
 MapRecenterFab.vue (emits: recenter)
 Each is dumb: props in, events out, no store access

Step 3.2 — StopSheet decomposition → app/components/stops/ ✅ DONE

 StopSheetHeader.vue (name, distance, favorite badge)
 ServedLineChips.vue (props: lines)
 ArrivalsList.vue + ArrivalRow.vue (props: arrivals, pending; emits: refresh)
 FavoriteGroupPicker.vue (the picker dialog)

Step 3.3 — AppDrawer decomposition → app/components/ui/ ✅ DONE

 StopSearchField.vue + StopSearchResults.vue (extract keyboard nav into useListKeyboardNav.ts — reusable + testable)
 FavoriteGroupsPanel.vue
 NearestStopsPanel.vue
 ConnectionStatusChip.vue (props: label, icon, color)
 ✅ Exit criteria: no component over ~200 lines; each new component has a single responsibility and a props/emits contract


Phase 4 — Clean Up the Page & App Shell
Step 4.1 — useAppTheme.ts ✅ DONE

 Move the SSR-safe cookie theme logic (with its excellent comments!) out of index.vue into a composable exposing { theme, isDark, toggleTheme }

Step 4.2 — useConnectionStatus.ts ✅ DONE

 Move connectionLabel/Icon/Color + usesScheduledData computeds out of index.vue
 Unit test the mapping table (connecting/reconnecting/scheduled/live/stale → label/icon/color)
 Fix the dead branch in AppDrawer.vue: connectionChipLabel checks 'Connecté', a label index.vue never produces

Step 4.3 — Slim the page ✅ DONE

 index.vue becomes layout + wiring only (~60 lines); hamburger FAB extracted to AppMenuFab.vue
 ✅ Exit criteria: page has no business logic; hydration still clean (no SSR mismatch warnings)


Phase 5 — Test Coverage & Hardening ✅ DONE

 Unit tests: all app/utils/* at ~100%, composables with mocked map (useConnectionStatus, useMapFraming, useListKeyboardNav)
 Component tests (Vitest + @vue/test-utils): ArrivalRow, ConnectionStatusChip, MapErrorAlert (props/emits contracts)
 Server unit tests: snapshot fallback priority in vehicles.get.ts (live → simulation)
 Playwright: theme toggle, line filter, stop selection → arrivals sheet
 ✅ Exit criteria: CI runs all suites; coverage report published as pipeline artifact


Phase 6 — Documentation ✅ DONE

 README.md: architecture diagram (stores ↔ composables ↔ layers), folder conventions
 Short CONTRIBUTING.md for juniors: "components are dumb, composables own behavior, utils are pure"
 ✅ Exit criteria: a new developer can locate where any behavior lives in <2 minutes


⚠️ Rules of Engagement (apply to every step)

One step = one MR — small, reviewable, revertible
Never mix a logic extraction with a behavior change in the same MR
Pipeline green before merging every step
Preserve the excellent inline comments explaining SSR/hydration and GPU fixes — move them with the code