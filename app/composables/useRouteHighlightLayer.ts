/**
 * useRouteHighlightLayer
 *
 * Emphasises ONE route polyline above the regular network lines: a white
 * casing plus the route's brand color at full opacity, and a camera fit so
 * the user actually sees the track after picking a line in the stop sheet.
 *
 * Same attach/detach contract as the other map-layer composables:
 *   attach(map) — add the dedicated source + layers, start the store watcher
 *   detach()    — stop the watcher and forget the map
 *
 * Data flow: StopSheet writes mapStore.highlightedRoute → the watcher here
 * resolves the geometry from the lines store shape cache and paints it.
 */
import type maplibregl from 'maplibre-gl'
import type { Ref } from 'vue'
import type { FeatureCollection } from 'geojson'
import { useMapStore, type HighlightedRoute } from '~/stores/map'
import { useLinesStore, type RouteShape } from '~/stores/lines'
import { multiLineStringBounds } from '~/utils/geojson'
import { routeHighlightLayers } from '~/utils/map-layers'

const SOURCE_ID = 'route-highlight'
const EMPTY_COLLECTION: FeatureCollection = { type: 'FeatureCollection', features: [] }

export function useRouteHighlightLayer(prefersReducedMotion: Ref<boolean>) {
  const mapStore = useMapStore()
  const linesStore = useLinesStore()

  let map: maplibregl.Map | null = null
  let stopWatching: (() => void) | null = null

  /**
   * Padding for fitBounds, capped to fractions of the viewport so MapLibre
   * never throws on small screens. The large bottom inset keeps the route
   * visible above the stop bottom sheet.
   */
  function fitPadding(m: maplibregl.Map) {
    const { clientWidth: width, clientHeight: height } = m.getContainer()
    return {
      top: Math.round(Math.min(72, height * 0.12)),
      right: Math.round(Math.min(48, width * 0.1)),
      left: Math.round(Math.min(48, width * 0.1)),
      bottom: Math.round(Math.min(300, height * 0.45)),
    }
  }

  /** Paint (and optionally frame) the highlighted route, or clear it. */
  async function applyHighlight(route: HighlightedRoute | null, fit: boolean) {
    const m = map
    if (!m) return
    const source = m.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    if (!source) return

    if (!route) {
      source.setData(EMPTY_COLLECTION)
      return
    }

    let shapes: RouteShape[]
    try {
      shapes = await linesStore.fetchShapes()
    }
    catch (error) {
      console.warn('[useRouteHighlightLayer] Unable to load route shapes:', error)
      return
    }
    // The map may have been detached (theme swap, unmount) during the await.
    if (map !== m || !m.getSource(SOURCE_ID)) return

    const shape = shapes.find(s => s.routeId === route.routeId)
    if (!shape) return

    source.setData({
      type: 'Feature',
      properties: { color: `#${shape.routeColor}` },
      geometry: shape.geometry,
    })

    if (!fit) return
    const bounds = multiLineStringBounds(shape.geometry)
    if (bounds) {
      m.fitBounds(bounds, {
        padding: fitPadding(m),
        maxZoom: 15.5,
        animate: !prefersReducedMotion.value,
      })
    }
  }

  /** Add the source + layers on `mapInstance` and start reacting to the store. */
  function attach(mapInstance: maplibregl.Map) {
    detach()
    map = mapInstance

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: 'geojson', data: EMPTY_COLLECTION })
    }
    // [casing, line] in draw order — the colored line renders on top.
    // Inserted beneath 'stop-clusters' so station points render above the
    // highlight, while the highlight stays above the regular route lines
    // (inserted before the same anchor, earlier).
    const beforeId = map.getLayer('stop-clusters') ? 'stop-clusters' : undefined
    for (const layer of routeHighlightLayers()) {
      if (!map.getLayer(layer.id)) map.addLayer(layer, beforeId)
    }

    // Repaint without moving the camera when re-attaching after a theme
    // swap while a highlight is still active.
    applyHighlight(mapStore.highlightedRoute, false)

    stopWatching = watch(
      () => mapStore.highlightedRoute,
      (route) => { applyHighlight(route, true) },
    )
  }

  function detach() {
    stopWatching?.()
    stopWatching = null
    map = null
  }

  return { attach, detach }
}
