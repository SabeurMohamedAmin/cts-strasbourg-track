/**
 * MapLibre layer spec factories (Step 1.4).
 *
 * Pure functions returning the option objects passed to map.addLayer().
 * Extracted from MapView.vue so ids, filters, visibility and paint rules
 * can be unit-tested without a WebGL context.
 *
 * Convention: layers start hidden ('none') when their visibility is driven
 * by UI state elsewhere (StopToggleButtons, line filter chips).
 */
import type {
  CircleLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl'
import { OFM_GLYPH_FALLBACK } from '~/utils/map-constants'

/**
 * Red bubbles grouping many stops at low zoom.
 * Only matches clustered features (those with a point_count).
 */
export function stopClusterLayer(): CircleLayerSpecification {
  return {
    id: 'stop-clusters',
    type: 'circle',
    source: 'stops',
    filter: ['has', 'point_count'],
    layout: { visibility: 'none' },
    paint: {
      'circle-color': '#c8102e',
      'circle-radius': 17,
      'circle-opacity': 0.9,
    },
  }
}

/**
 * White count label rendered on top of each cluster bubble.
 * Uses the OFM glyph fallback font so digits render on every style.
 */
export function stopClusterCountLayer(): SymbolLayerSpecification {
  return {
    id: 'stop-cluster-count',
    type: 'symbol',
    source: 'stops',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['to-string', ['coalesce', ['get', 'point_count'], 0]],
      'text-size': 12,
      'text-font': [OFM_GLYPH_FALLBACK],
      'text-allow-overlap': true,
      visibility: 'none',
    },
    paint: { 'text-color': '#ffffff' },
  }
}

/**
 * Individual stop dots at high zoom (non-clustered features only).
 * The ring color is data-driven: amber for favourites, CTS red otherwise.
 */
export function unclusteredStopsLayer(): CircleLayerSpecification {
  return {
    id: 'unclustered-stops',
    type: 'circle',
    source: 'stops',
    filter: ['!', ['has', 'point_count']],
    layout: { visibility: 'none' },
    paint: {
      'circle-color': '#ffffff',
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 4, 16, 7],
      'circle-stroke-color': ['case', ['get', 'favourite'], '#f59e0b', '#c8102e'],
      'circle-stroke-width': ['case', ['get', 'favourite'], 3, 2],
    },
  }
}

/**
 * Highlight ring around the currently selected stop.
 * The filter starts matching nothing (empty id); MapView swaps it via
 * setFilter when stopsStore.selectedStopId changes.
 */
export function selectedStopRingLayer(): CircleLayerSpecification {
  return {
    id: 'selected-stop-ring',
    type: 'circle',
    source: 'stops',
    filter: ['==', ['get', 'id'], ''],
    paint: {
      'circle-color': 'transparent',
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 9, 16, 14],
      'circle-stroke-color': '#c8102e',
      'circle-stroke-width': 3,
      'circle-stroke-opacity': 0.6,
    },
  }
}

/**
 * The two layers drawing one route: a soft glow underneath and the crisp
 * line on top. Returned in draw order — add them in array order.
 *
 * @param routeId    GTFS route id; also names the GeoJSON source `route-${id}`
 * @param routeColor route brand color — hex WITHOUT leading # (GTFS format)
 * @param visible    initial visibility (driven by the line filter chips)
 * @param mode       'tram' uses a thinner width ramp: tram routes carry the
 *                   forward and return tracks as two nearly-overlapping
 *                   lines, so a full-width stroke rendered twice reads far
 *                   too heavy on the map
 */
export function routeLineLayers(
  routeId: string,
  routeColor: string,
  visible: boolean,
  mode: 'tram' | 'bus' = 'bus',
): [LineLayerSpecification, LineLayerSpecification] {
  const sourceId = `route-${routeId}`
  const lineColor = `#${routeColor}`
  const visibility = visible ? 'visible' : 'none'

  const glow: LineLayerSpecification = {
    id: `${sourceId}-glow`,
    type: 'line',
    source: sourceId,
    paint: {
      'line-color': lineColor,
      'line-width': mode === 'tram'
        ? ['interpolate', ['linear'], ['zoom'], 9, 3, 12, 5, 15, 8]
        : ['interpolate', ['linear'], ['zoom'], 9, 6, 12, 10, 15, 16],
      'line-opacity': 0.22,
      'line-blur': 6,
    },
    layout: { 'line-join': 'round', 'line-cap': 'round', visibility },
  }

  const line: LineLayerSpecification = {
    id: sourceId,
    type: 'line',
    source: sourceId,
    paint: {
      'line-color': lineColor,
      'line-width': mode === 'tram'
        ? ['interpolate', ['linear'], ['zoom'], 9, 0.8, 12, 1.8, 15, 3]
        : ['interpolate', ['linear'], ['zoom'], 9, 1.5, 12, 3.5, 15, 6],
      'line-opacity': 0.92,
    },
    layout: { 'line-join': 'round', 'line-cap': 'round', visibility },
  }

  return [glow, line]
}

/**
 * The two layers emphasising the route picked in the stop sheet: a white
 * casing underneath and the route's brand color at full opacity on top.
 * Both read from the dedicated 'route-highlight' GeoJSON source, whose
 * single feature carries its color in the `color` property — so one layer
 * pair serves every route without rebuilding.
 */
export function routeHighlightLayers(): [LineLayerSpecification, LineLayerSpecification] {
  const casing: LineLayerSpecification = {
    id: 'route-highlight-casing',
    type: 'line',
    source: 'route-highlight',
    paint: {
      'line-color': '#ffffff',
      'line-width': ['interpolate', ['linear'], ['zoom'], 9, 5, 12, 8, 15, 12],
      'line-opacity': 0.9,
    },
    layout: { 'line-join': 'round', 'line-cap': 'round' },
  }

  const line: LineLayerSpecification = {
    id: 'route-highlight',
    type: 'line',
    source: 'route-highlight',
    paint: {
      'line-color': ['coalesce', ['get', 'color'], '#c8102e'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 9, 2.5, 12, 4.5, 15, 7.5],
      'line-opacity': 1,
    },
    layout: { 'line-join': 'round', 'line-cap': 'round' },
  }

  return [casing, line]
}
