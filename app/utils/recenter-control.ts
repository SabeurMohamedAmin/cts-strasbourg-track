/**
 * RecenterControl — native MapLibre control snapping the camera back to the
 * Strasbourg-centered Eurométropole frame.
 *
 * Implemented as a maplibregl.IControl so it lives in the same top-right
 * control stack as the zoom and geolocate (find my location) buttons, with
 * identical UI/UX: same 29px button, hover state, focus ring and native
 * `title` tooltip. MapLibre removes the control automatically when the map
 * is destroyed.
 */
import type { IControl, Map as MapLibreMap } from 'maplibre-gl'

/**
 * mdi-image-filter-center-focus as an inline SVG, using the same #333 fill
 * as MapLibre's built-in control icons so it matches in both themes.
 */
const RECENTER_ICON_SVG
  = '<svg xmlns="https://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18">'
  + '<path fill="#333" d="M12 9a3 3 0 0 1 3 3 3 3 0 0 1-3 3 3 3 0 0 1-3-3 3 3 0 0 1 3-3'
  + 'M5 15H3v4a2 2 0 0 0 2 2h4v-2H5v-4M5 5h4V3H5a2 2 0 0 0-2 2v4h2V5'
  + 'm14-2h-4v2h4v4h2V5a2 2 0 0 0-2-2m0 16h-4v2h4a2 2 0 0 0 2-2v-4h-2v4Z"/>'
  + '</svg>'

export class RecenterControl implements IControl {
  private container: HTMLElement | undefined

  constructor(private readonly onRecenter: () => void) {}

  onAdd(_map: MapLibreMap): HTMLElement {
    // Same markup as MapLibre's built-in controls: a .maplibregl-ctrl-group
    // wrapping a 29px button with a background-image icon span. All hover,
    // focus and sizing styles come for free from maplibre-gl.css.
    const container = document.createElement('div')
    container.className = 'maplibregl-ctrl maplibregl-ctrl-group'

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'maplibregl-ctrl-recenter'
    button.title = 'Recentrer la carte'
    button.setAttribute('aria-label', 'Recentrer la carte sur Strasbourg')
    button.addEventListener('click', () => this.onRecenter())

    const icon = document.createElement('span')
    icon.className = 'maplibregl-ctrl-icon'
    icon.setAttribute('aria-hidden', 'true')
    icon.style.backgroundImage
      = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(RECENTER_ICON_SVG)}")`

    button.appendChild(icon)
    container.appendChild(button)
    this.container = container
    return container
  }

  onRemove(): void {
    this.container?.remove()
    this.container = undefined
  }
}
