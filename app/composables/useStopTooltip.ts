/**
 * useStopTooltip (Step 2.4)
 *
 * Owns the small themed tooltip showing a stop name on hover.
 * A single popup instance is created lazily and reused for every stop —
 * MapLibre popups are expensive to create and cheap to move.
 */
import maplibregl from 'maplibre-gl'
import type { ShallowRef } from 'vue'

export function useStopTooltip(map: ShallowRef<maplibregl.Map | undefined>) {
  let hoverPopup: maplibregl.Popup | null = null // single reused tooltip instance

  /**
   * Show a small themed tooltip with the stop name.
   * Uses setDOMContent + textContent so GTFS names can never inject HTML.
   */
  function show(lngLat: maplibregl.LngLatLike, name: string) {
    if (!map.value) return
    const content = document.createElement('div')
    content.className = 'stop-tooltip'
    content.textContent = name
    hoverPopup ??= new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
      className: 'map-hover-popup',
    })
    hoverPopup.setLngLat(lngLat).setDOMContent(content).addTo(map.value)
  }

  function hide() { hoverPopup?.remove() }

  onUnmounted(() => {
    hoverPopup?.remove()
    hoverPopup = null
  })

  return { show, hide }
}
