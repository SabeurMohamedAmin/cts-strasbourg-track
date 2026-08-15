/**
 * useMapInstance (Step 2.1)
 *
 * Owns the raw MapLibre map object and everything tied to its lifetime:
 *   - map creation with shared defaults (attribution, transformRequest)
 *   - standard controls: navigation, geolocate, scale
 *   - the glyph transformRequest fix (OFM font stacks would 404 otherwise)
 *   - 1x1 transparent fallback images so missing sprite icons never throw
 *   - destruction when the owning component unmounts
 *
 * `map` is a shallowRef on purpose: the MapLibre instance must never be
 * made deeply reactive — Vue's proxying would break its internal WebGL
 * bookkeeping and cost a lot of memory.
 */
import maplibregl from 'maplibre-gl'
import { OFM_GLYPH_FALLBACK, type BoundsTuple } from '~/utils/map-constants'

/** Framing + style options the caller controls; everything else is owned here. */
export interface CreateMapOptions {
  style: string
  center: [number, number]
  zoom: number
  /** Guard 1: hard pan lock — viewport center can NEVER leave this box. */
  maxBounds: BoundsTuple
  /**
   * minZoom should start permissive so fitBounds can run freely on load;
   * the framing logic tightens it afterwards (Guard 2).
   */
  minZoom: number
  maxZoom: number
}

export function useMapInstance() {
  const map = shallowRef<maplibregl.Map | undefined>(undefined)
  const mapReady = ref(false) // drives the canvas fade-in

  // ── Glyph transform ─────────────────────────────────────────────────

  /**
   * Rewrite glyph requests to a font stack OpenFreeMap actually serves.
   * Some styles reference stacks that 404; swapping in the fallback keeps
   * every text layer rendering.
   */
  function buildTransformRequest(url: string, resourceType: string): maplibregl.RequestParameters {
    if (resourceType === 'Glyphs' && url.includes('/fonts/')) {
      const fixed = url.replace(
        /(https?:\/\/[^/]+\/fonts\/)([^/]+)(\/)/,
        (_m, pre, _stack, suf) => `${pre}${encodeURIComponent(OFM_GLYPH_FALLBACK)}${suf}`,
      )
      return { url: fixed }
    }
    return { url }
  }

  // ── Fallback images ─────────────────────────────────────────────────

  /**
   * Register 1x1 transparent placeholders for sprite icons the style may
   * request but not ship. Must be re-run after every style swap (setStyle
   * wipes all added images).
   */
  function registerFallbackImages() {
    const instance = map.value
    if (!instance) return
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const imageData = canvas.getContext('2d')!.getImageData(0, 0, 1, 1)
    for (const name of ['boules', 'running']) {
      if (!instance.hasImage(name)) instance.addImage(name, imageData)
    }
    instance.on('styleimagemissing', (e: { id: string }) => {
      if (!instance.hasImage(e.id)) instance.addImage(e.id, imageData)
    })
  }

  // ── Lifecycle ───────────────────────────────────────────────────────

  /** Create the map in `container`, add controls, and track it in `map`. */
  function createMap(container: HTMLElement, options: CreateMapOptions): maplibregl.Map {
    const instance = new maplibregl.Map({
      container,
      style: options.style,
      center: options.center,
      zoom: options.zoom,
      maxBounds: options.maxBounds,
      minZoom: options.minZoom,
      maxZoom: options.maxZoom,
      attributionControl: true,
      transformRequest: buildTransformRequest,
    })

    instance.addControl(new maplibregl.NavigationControl(), 'top-right')

    const geolocateControl = new maplibregl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15_000,
      },
      trackUserLocation: true,
      showUserLocation: true,
      showAccuracyCircle: true,
      showUserHeading: true,
      fitBoundsOptions: { maxZoom: 16 },
    })
    instance.addControl(geolocateControl, 'top-right')
    instance.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left')

    // Start location tracking without showing a new permission prompt. When
    // permission has not been granted yet, the user remains in control and
    // can enable it with the location button.
    instance.once('load', async () => {
      if (!navigator.permissions) return

      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' })
        if (permission.state === 'granted') geolocateControl.trigger()
      }
      catch {
        // Some browsers expose geolocation but not its Permissions API entry.
        // The location button still works normally in those browsers.
      }
    })

    map.value = instance

    // This listener is registered before any caller's 'load' handler, so
    // fallback images exist by the time network layers are added.
    instance.on('load', () => {
      registerFallbackImages()
      mapReady.value = true // triggers the CSS fade-in
    })

    return instance
  }

  /** Tear the map down. Idempotent — safe to call twice. */
  function destroyMap() {
    map.value?.remove()
    map.value = undefined
    mapReady.value = false
  }

  onUnmounted(destroyMap)

  return { map, mapReady, createMap, destroyMap, registerFallbackImages }
}
