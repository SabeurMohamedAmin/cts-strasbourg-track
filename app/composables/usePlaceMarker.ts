/**
 * usePlaceMarker (Step 2.4)
 *
 * Owns the pin for an address / city picked in the search panel:
 * watches mapStore.focusedPlace, drops a fresh marker and flies the camera
 * to it, and removes the marker on unmount.
 */
import maplibregl from 'maplibre-gl'
import type { Ref, ShallowRef } from 'vue'
import { useMapStore } from '~/stores/map'

export function usePlaceMarker(
  map: ShallowRef<maplibregl.Map | undefined>,
  prefersReducedMotion: Ref<boolean>,
) {
  const mapStore = useMapStore()

  let placeMarker: maplibregl.Marker | null = null // pin for a searched address / city

  // Address / city picked in the search panel: drop a pin and fly there.
  // The map store always assigns a fresh object, so this fires even when the
  // user selects the same place twice in a row.
  watch(() => mapStore.focusedPlace, (place) => {
    const m = map.value
    if (!m) return
    placeMarker?.remove()
    placeMarker = null
    if (!place) return
    placeMarker = new maplibregl.Marker({ color: '#c8102e' })
      .setLngLat([place.lon, place.lat])
      .addTo(m)
    m.flyTo({
      center: [place.lon, place.lat],
      zoom: Math.max(m.getZoom(), 15.5),
      animate: !prefersReducedMotion.value,
    })
  })

  onUnmounted(() => {
    placeMarker?.remove()
    placeMarker = null
  })
}
