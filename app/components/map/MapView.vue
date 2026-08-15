<script setup lang="ts">
import type maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useStopsStore } from '~/stores/stops'
import StopToggleButtons from '~/components/map/StopToggleButtons.vue'
import MapLoadingOverlay from '~/components/map/MapLoadingOverlay.vue'
import MapErrorAlert from '~/components/map/MapErrorAlert.vue'
import { useMapInstance } from '~/composables/useMapInstance'
import { useTramStopLayer } from '~/composables/useTramStopLayer'
import { useBusStopLayer } from '~/composables/useBusStopLayer'
import { useLandmarkLayer } from '~/composables/useLandmarkLayer'
import { useMapFraming } from '~/composables/useMapFraming'
import { useNetworkLayers } from '~/composables/useNetworkLayers'
import { useRouteHighlightLayer } from '~/composables/useRouteHighlightLayer'
import { useStopTooltip } from '~/composables/useStopTooltip'
import { usePlaceMarker } from '~/composables/usePlaceMarker'
import { useFocusStationsArea } from '~/composables/useFocusStationsArea'
import { useMapThemeSync } from '~/composables/useMapThemeSync'
import { ABSOLUTE_MIN_ZOOM, STRASBOURG_CENTER } from '~/utils/map-constants'
import { RecenterControl } from '~/utils/recenter-control'

// MapView is an ORCHESTRATOR: each behavior lives in a dedicated composable
// (Phase 2) and this component only wires them together.
//   useMapInstance   (2.1) — map object, controls, glyph fix, fallback images
//   useMapFraming    (2.2) — responsive bounds, two-guard zoom lock, recenter
//   useNetworkLayers (2.3) — stops + route lines, events, loading/error state
//   useStopTooltip   (2.4) — XSS-safe hover tooltip
//   usePlaceMarker   (2.4) — searched-place pin + flyTo
//   useMapThemeSync  (2.5) — style swap + debounced layer rebuild

const mapContainer = ref<HTMLDivElement>()
const stopsStore = useStopsStore()

const { map, mapReady, createMap, registerFallbackImages } = useMapInstance()
const { eurometropoleBounds, prefersReducedMotion, fitEurometropole, recenter } = useMapFraming(map)
const {
  loading,
  errorMessage,
  networkLoaded,
  attach: attachNetworkLayers,
  detach: detachNetworkLayers,
  retry: retryLoad,
} = useNetworkLayers()
const { attach: attachVehicleLayer, detach: detachVehicleLayer } = useVehicleLayer()
const { attach: attachTramStopLayer, detach: detachTramStopLayer, stationsVisible: tramStationsVisible } = useTramStopLayer()
const { attach: attachBusStopLayer, detach: detachBusStopLayer, stationsVisible: busStationsVisible } = useBusStopLayer()
const { attach: attachLandmarkLayer, detach: detachLandmarkLayer } = useLandmarkLayer()
const { attach: attachRouteHighlight, detach: detachRouteHighlight } = useRouteHighlightLayer(prefersReducedMotion)
const { show: showStopTooltip, hide: hideStopTooltip } = useStopTooltip(map)
usePlaceMarker(map, prefersReducedMotion)
const { overlayStyle: focusAreaStyle } = useFocusStationsArea(map)
const { isDark, styleForTheme } = useMapThemeSync(map, { reloadLayers })

/**
 * Wiring passed to useNetworkLayers on every attach:
 * tram/bus stop layers keep their draw order; the tooltip is owned by
 * useStopTooltip (Step 2.4).
 */
function networkLayerHooks() {
  return {
    onLayersAdded: (m: maplibregl.Map) => {
      // Highlight first: it must render above the route lines but below
      // the tram/bus station icons added right after.
      attachRouteHighlight(m)
      attachTramStopLayer(m, isDark())
      attachBusStopLayer(m, isDark())
      attachLandmarkLayer(m, isDark(), prefersReducedMotion)
    },
    onStopHover: showStopTooltip,
    onStopLeave: hideStopTooltip,
  }
}

/**
 * Full custom-layer rebuild after a base-style swap.
 * Called (debounced) by useMapThemeSync once the new style has loaded.
 */
async function reloadLayers() {
  if (!map.value) return
  detachVehicleLayer()
  detachRouteHighlight()
  detachTramStopLayer()
  detachBusStopLayer()
  detachLandmarkLayer()
  detachNetworkLayers()
  registerFallbackImages() // setStyle wiped them; useMapInstance re-adds
  await attachNetworkLayers(map.value, networkLayerHooks())
  if (map.value) attachVehicleLayer(map.value)
}

// Selected stop: highlight ring + fly to it.
watch(() => stopsStore.selectedStopId, (stopId) => {
  const m = map.value
  if (!m || !m.isStyleLoaded()) return
  m.setFilter('selected-stop-ring', ['==', ['get', 'id'], stopId ?? ''])
  if (!stopId) return
  const stop = stopsStore.stops.find(s => s.stopId === stopId)
  if (stop) {
    m.flyTo({
      center: [stop.stopLon, stop.stopLat],
      zoom: Math.max(m.getZoom(), 15),
      animate: !prefersReducedMotion.value,
    })
  }
})

onMounted(() => {
  const instance = createMap(mapContainer.value!, {
    style: styleForTheme(isDark()),
    center: STRASBOURG_CENTER,
    zoom: 10,
    // Guard 1: hard pan lock — viewport center can NEVER leave this box.
    // No gliding left / right / up / down past these edges, ever.
    maxBounds: eurometropoleBounds.value,
    // minZoom starts permissive so fitBounds can run freely on load.
    // fitEurometropole() will tighten it to the fitted zoom level.
    minZoom: ABSOLUTE_MIN_ZOOM,
    maxZoom: 18,
  })

  // Recenter control: lives in the same top-right stack as the native zoom
  // and geolocate buttons, snapping back to the Strasbourg-centered frame.
  instance.addControl(new RecenterControl(() => recenter()), 'top-right')

  instance.on('load', () => {
    // Snap to validated frame + lock minZoom (Guard 2), then center Strasbourg.
    fitEurometropole(false)
    attachNetworkLayers(instance, networkLayerHooks())
    attachVehicleLayer(instance)
  })

  instance.on('error', (event) => {
    const isTileError
      = event.error?.message?.includes('404')
      || event.error?.message?.includes('Failed to fetch')
      || event.error?.message?.includes('NetworkError')
    if (!networkLoaded.value && !isTileError) {
      console.error('[MapView] Fatal map error', event.error)
      loading.value = false
      errorMessage.value = 'Le fond de carte ne peut pas être chargé pour le moment.'
    }
    else {
      console.debug('[MapView] Recoverable map error', event.error?.message)
    }
  })
})

onUnmounted(() => {
  detachVehicleLayer()
  detachRouteHighlight()
  detachTramStopLayer()
  detachBusStopLayer()
  detachLandmarkLayer()
  detachNetworkLayers()
  // Tooltip, place marker, style-reload timer and the map itself are cleaned
  // up by their own composables' unmount hooks (Steps 2.1 / 2.4 / 2.5).
})
</script>

<template>
  <div class="map-shell">

    <!-- MapLibre canvas target (fades in once the style has loaded) -->
    <div ref="mapContainer" class="map-container" :class="{ 'map-container--ready': mapReady }" />

    <!-- focus-stations-area: radial spotlight following the pointer.
         Station icons inside stay at 80% opacity, outside drop to 20%
         (handled by useFocusStationsArea via feature-state). -->
    <div v-if="mapReady" class="focus-stations-area" :style="focusAreaStyle" />

    <!-- Loading overlay: branded spinner with blurred backdrop -->
    <v-fade-transition>
      <MapLoadingOverlay v-if="loading" />
    </v-fade-transition>

    <!-- Error alert: slides in from the top, prominent retry -->
    <v-slide-y-transition>
      <MapErrorAlert
        v-if="errorMessage"
        :message="errorMessage"
        @retry="retryLoad"
        @close="errorMessage = null"
      />
    </v-slide-y-transition>

    <!-- Stop toggle buttons: slide up once the network is ready -->
    <v-slide-y-reverse-transition>
      <StopToggleButtons
        v-if="!loading"
        :tram-visible="tramStationsVisible"
        :bus-visible="busStationsVisible"
        @toggle-tram="tramStationsVisible = !tramStationsVisible"
        @toggle-bus="busStationsVisible = !busStationsVisible"
      />
    </v-slide-y-reverse-transition>

  </div>
</template>

<style scoped>
.map-shell {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

/* Canvas fades in once the style has loaded — no harsh white flash */
.map-container {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.6s ease;
}
.map-container--ready {
  opacity: 1;
}

/* focus-stations-area: soft radial highlight, solid until 30% of the
   radius, then fading out to fully transparent at the edge. */
.focus-stations-area {
  position: absolute;
  pointer-events: none; /* never intercepts map gestures */
  border-radius: 50%
}

/* Themed, rounded MapLibre controls */
.map-container :deep(.maplibregl-ctrl-group) {
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.18);
}

/* Sweet hover tooltip for stop names */
.map-container :deep(.map-hover-popup .maplibregl-popup-content) {
  padding: 6px 12px;
  border-radius: 8px;
  /* Glassy tooltip to match the rest of the floating UI */
  background-color: rgba(var(--v-theme-surface), 0.7);
  backdrop-filter: blur(12px) saturate(1.5);
  -webkit-backdrop-filter: blur(12px) saturate(1.5);
  color: rgb(var(--v-theme-on-surface));
  box-shadow: 0 4px 14px rgb(0 0 0 / 0.22);
  font-size: 0.8125rem;
  font-weight: 500;
}
.map-container :deep(.map-hover-popup .maplibregl-popup-tip) {
  border-top-color: rgba(var(--v-theme-surface), 0.7);
}

/* Accessibility: kill decorative animations for users who opt out */
@media (prefers-reduced-motion: reduce) {
  .map-container {
    transition: none;
  }
}
</style>
