/**
 * useNetworkLayers (Step 2.3)
 *
 * Owns the static CTS network on the map:
 *   - the clustered 'stops' source + cluster / unclustered / selected-ring layers
 *   - the colored route lines (glow + crisp line, one source per route)
 *   - the click / hover event bindings for clusters and stops
 *   - the route-visibility and stop-source watchers
 *   - the loading / error state shown by the map overlays
 *
 * Same attach/detach contract as useVehicleLayer, useTramStopLayer and
 * useBusStopLayer, so every map feature follows one single pattern:
 *   attach(map, hooks) — load data, add sources/layers, bind events, watch stores
 *   detach()           — stop watchers and forget the map (layers die with the style)
 *   retry()            — clear the error and reload the network from scratch
 *
 * attach() is awaitable: the theme-reload flow needs to wait until the
 * network layers exist before re-attaching the vehicle layer on top.
 */
import type maplibregl from 'maplibre-gl'
import { useStopsStore } from '~/stores/stops'
import { useLinesStore } from '~/stores/lines'
import { buildStopFeatureCollection } from '~/utils/geojson'
import { isLandmarkClick } from '~/utils/landmarks'
import {
  routeLineLayers,
  selectedStopRingLayer,
  stopClusterCountLayer,
  stopClusterLayer,
  unclusteredStopsLayer,
} from '~/utils/map-layers'

/** Optional callbacks the owning component plugs into the layer lifecycle. */
export interface NetworkLayerHooks {
  /**
   * Called once all network sources/layers exist — the owner attaches the
   * tram/bus stop layers here so the draw order stays exactly as before.
   */
  onLayersAdded?: (map: maplibregl.Map) => void
  /** Mouse entered an unclustered stop — the owner shows the name tooltip. */
  onStopHover?: (lngLat: [number, number], name: string) => void
  /** Mouse left the unclustered stops layer — the owner hides the tooltip. */
  onStopLeave?: () => void
}

export function useNetworkLayers() {
  const stopsStore = useStopsStore()
  const linesStore = useLinesStore()

  const loading = ref(true)
  const errorMessage = ref<string | null>(null)
  /** True once sources, layers and bindings are in place for this style. */
  const networkLoaded = ref(false)

  let map: maplibregl.Map | null = null
  let hooks: NetworkLayerHooks = {}
  let isLoadingNetwork = false
  let stopWatchingLines: (() => void) | null = null
  let stopWatchingStops: (() => void) | null = null

  const visibleRouteIds = computed(() => new Set(linesStore.activeLineIds))

  // ── Source updates ────────────────────────────────────────────

  /** Snapshot of the store's stops + favourites as a GeoJSON FeatureCollection. */
  function stopFeatureCollection() {
    return buildStopFeatureCollection(stopsStore.stops, stopsStore.favoriteStopIds)
  }

  // No isStyleLoaded() guards below: it reports false while tiles/sprites
  // are still streaming (e.g. right after a theme swap), which silently
  // dropped updates. getSource/getLayer are safe on a loading style.

  function updateStopSource() {
    if (!map) return
    const source = map.getSource('stops') as maplibregl.GeoJSONSource | undefined
    source?.setData(stopFeatureCollection())
  }

  function updateRouteVisibility() {
    if (!map) return
    for (const line of linesStore.lines) {
      const visibility = visibleRouteIds.value.has(line.routeId) ? 'visible' : 'none'
      if (map.getLayer(`route-${line.routeId}-glow`)) map.setLayoutProperty(`route-${line.routeId}-glow`, 'visibility', visibility)
      if (map.getLayer(`route-${line.routeId}`)) map.setLayoutProperty(`route-${line.routeId}`, 'visibility', visibility)
    }
  }

  // ── Layer construction ────────────────────────────────────────

  async function addNetworkLayers() {
    const m = map
    if (!m || networkLoaded.value || isLoadingNetwork) return
    isLoadingNetwork = true
    try {
      await Promise.all([linesStore.fetchLines(), stopsStore.fetchStops()])
      // Staleness check after each await: detach() nulls `map` when the
      // component unmounts or a theme swap rebuilds the layers. We must NOT
      // use isStyleLoaded() here — it reports false while the new style is
      // still streaming tiles/sprites (always the case right after a dark
      // mode swap) and silently skipped everything below.
      if (map !== m) { isLoadingNetwork = false; return }

      m.addSource('stops', {
        type: 'geojson',
        data: stopFeatureCollection(),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 45,
      })
      // Layer specs are named factories in app/utils/map-layers.ts (Step 1.4).
      m.addLayer(stopClusterLayer())
      m.addLayer(stopClusterCountLayer())
      m.addLayer(unclusteredStopsLayer())
      m.addLayer(selectedStopRingLayer())

      // Shared cache in the lines store — the route-highlight layer reuses it.
      const shapes = await linesStore.fetchShapes()
      if (map !== m) { isLoadingNetwork = false; return }

      // routeType lookup: trams (GTFS type 0) get the thinner line variant
      // because their forward and return tracks overlap on the map.
      const routeTypeById = new Map(linesStore.lines.map(line => [line.routeId, line.routeType]))

      for (const shape of shapes) {
        const sourceId = `route-${shape.routeId}`
        if (m.getSource(sourceId)) continue
        m.addSource(sourceId, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: shape.geometry } })
        // [glow, line] in draw order — the crisp line renders on top of the glow.
        // Inserted beneath 'stop-clusters' (the bottom-most stop layer) so
        // station points always render above the route lines.
        const mode = routeTypeById.get(shape.routeId) === 0 ? 'tram' as const : 'bus' as const
        for (const layer of routeLineLayers(shape.routeId, shape.routeColor, visibleRouteIds.value.has(shape.routeId), mode)) {
          m.addLayer(layer, 'stop-clusters')
        }
      }

      // Owner hook: tram/bus stop layers attach here, after the route lines.
      hooks.onLayersAdded?.(m)

      m.on('click', 'stop-clusters', async (event) => {
        // A landmark pin on top of this cluster owns the click
        if (isLandmarkClick(m, event.point)) return
        const feature = event.features?.[0]
        const clusterId = feature?.properties?.cluster_id
        if (clusterId === undefined || feature?.geometry.type !== 'Point') return
        const source = m.getSource('stops') as maplibregl.GeoJSONSource
        const zoom = await source.getClusterExpansionZoom(clusterId)
        m.easeTo({ center: feature.geometry.coordinates as [number, number], zoom })
      })
      m.on('click', 'unclustered-stops', (event) => {
        // A landmark pin on top of this stop owns the click (zoom + center only)
        if (isLandmarkClick(m, event.point)) return
        const id = event.features?.[0]?.properties?.id
        if (id) stopsStore.selectStop(id)
      })

      m.on('mouseenter', 'stop-clusters', () => { m.getCanvas().style.cursor = 'pointer' })
      m.on('mouseleave', 'stop-clusters', () => { m.getCanvas().style.cursor = '' })

      m.on('mouseenter', 'unclustered-stops', (event) => {
        m.getCanvas().style.cursor = 'pointer'
        const feature = event.features?.[0]
        if (feature?.geometry.type === 'Point' && feature.properties?.name)
          hooks.onStopHover?.(feature.geometry.coordinates as [number, number], String(feature.properties.name))
      })
      m.on('mouseleave', 'unclustered-stops', () => {
        m.getCanvas().style.cursor = ''
        hooks.onStopLeave?.()
      })

      networkLoaded.value = true
    }
    finally { isLoadingNetwork = false }
  }

  async function loadNetwork() {
    loading.value = true
    errorMessage.value = null
    try { await addNetworkLayers() }
    catch (error) {
      console.error('[useNetworkLayers] Unable to load GTFS layers', error)
      errorMessage.value = 'Impossible de charger le réseau CTS. Vérifiez la connexion et réessayez.'
    }
    finally { loading.value = false }
  }

  // ── Public contract ────────────────────────────────────────────

  /**
   * Bind to a map, start the store watchers and load the network.
   * Awaitable: the theme-reload flow waits for the layers before
   * re-attaching the vehicle layer on top.
   */
  async function attach(mapInstance: maplibregl.Map, layerHooks: NetworkLayerHooks = {}) {
    // Detach any watchers left over from a previous attach so they never stack.
    if (map) detach()
    map = mapInstance
    hooks = layerHooks

    stopWatchingLines = watch(() => linesStore.activeLineIds, updateRouteVisibility, { deep: true })
    stopWatchingStops = watch([() => stopsStore.stops, () => stopsStore.favoriteStops], updateStopSource, { deep: true })

    await loadNetwork()
  }

  function detach() {
    stopWatchingLines?.()
    stopWatchingStops?.()
    stopWatchingLines = null
    stopWatchingStops = null
    networkLoaded.value = false
    isLoadingNetwork = false
    map = null
  }

  /** Error-alert action: clear the error and rebuild the network from scratch. */
  function retry() {
    errorMessage.value = null
    networkLoaded.value = false
    isLoadingNetwork = false
    loadNetwork()
  }

  return { loading, errorMessage, networkLoaded, attach, detach, retry }
}
