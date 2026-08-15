/**
 * map store
 *
 * Bridges the search panel and the map: when the user picks an address or a
 * city in StopSearch, the panel writes the target here and MapView reacts
 * (flies to the coordinates and drops a pin).
 *
 * Kept intentionally tiny — anything stop-related stays in the stops store.
 */
import { defineStore } from 'pinia'

export interface FocusedPlace {
  /** Human-readable label, e.g. "12 Rue du Faubourg National". */
  label: string
  lat: number
  lon: number
}

export interface HighlightedRoute {
  /** GTFS route id of the line emphasised on the map. */
  routeId: string
}

export const useMapStore = defineStore('map', () => {
  const focusedPlace = ref<FocusedPlace | null>(null)

  /**
   * Fly the map to a place.  A fresh object is assigned every call so the
   * MapView watcher fires even when the user picks the same place twice.
   */
  function focusPlace(place: FocusedPlace) {
    focusedPlace.value = { ...place }
  }

  /** Remove the pin and forget the focused place. */
  function clearFocusedPlace() {
    focusedPlace.value = null
  }

  /**
   * focus-stations-area — per-stop icon scale (1 = normal, 0.5 = half size).
   * Written (throttled) by useFocusStationsArea, read by the tram/bus stop
   * layers when building their GeoJSON. icon-size is a MapLibre LAYOUT
   * property and cannot read feature-state, so the factor has to travel
   * through the source properties instead.
   */
  const stopFocusScale = ref<Record<string, number>>({})

  function setStopFocusScales(scales: Record<string, number>) {
    stopFocusScale.value = scales
  }

  /**
   * Route currently emphasised on the map — written by StopSheet when the
   * user picks a line, read by useRouteHighlightLayer. A fresh object is
   * assigned on every call (same pattern as focusPlace) so re-selecting the
   * same line re-triggers the camera fit.
   */
  const highlightedRoute = ref<HighlightedRoute | null>(null)

  function highlightRoute(routeId: string) {
    highlightedRoute.value = { routeId }
  }

  function clearHighlightedRoute() {
    highlightedRoute.value = null
  }

  return {
    focusedPlace,
    focusPlace,
    clearFocusedPlace,
    stopFocusScale,
    setStopFocusScales,
    highlightedRoute,
    highlightRoute,
    clearHighlightedRoute,
  }
})
