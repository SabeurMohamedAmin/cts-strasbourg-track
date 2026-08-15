/**
 * useNearestStops — requests the user's geolocation and fetches the
 * closest stops from /api/stops/nearby.
 *
 * After calling requestLocation():
 *   - nearest  → array of { stopId, stopName, distanceM } sorted by distance
 *   - loading  → true while the API call is in flight
 *   - error    → localised French error string, or null
 *
 * When the user taps a nearby stop, the stop's pre-computed distance is
 * written into stopsStore.selectedStopDistance so StopSheet can display
 * the walking-distance chip without any extra calculation.
 */
import { useStopsStore } from '~/stores/stops'

export function useNearestStops() {
  const nearest = ref<Array<{ stopId: string; stopName: string; distanceM: number }>>([])
  const loading = ref(false)
  const locating = ref(false)
  const error = ref<string | null>(null)
  const { location, setLocation } = useUserLocation()
  const stopsStore = useStopsStore()

  async function findNearest(lat: number, lon: number, limit = 5, radius = 1_000) {
    loading.value = true
    error.value = null
    try {
      const data = await $fetch<Array<{ stopId: string; stopName: string; distanceM: number }>>(
        '/api/stops/nearby',
        { query: { lat, lon, limit, radius } },
      )
      nearest.value = data
    }
    catch (e: any) {
      error.value = e.message ?? 'Erreur de géolocalisation'
    }
    finally {
      loading.value = false
    }
  }

  /**
   * selectNearby — selects a stop and immediately populates selectedStopDistance
   * with the pre-computed metres value returned by the nearby API.
   * Called from StopSearch when the user taps a nearby-stop row.
   */
  function selectNearby(stopId: string) {
    const hit = nearest.value.find(s => s.stopId === stopId)
    stopsStore.selectStop(stopId)
    // Write the distance so StopSheet can display "∼ 250 m" without a
    // second haversine calculation.
    stopsStore.selectedStopDistance = hit?.distanceM ?? null
  }

  /**
   * clearNearest — resets all nearby state.
   * Called when the user taps × (Fermer) on the nearby card in StopSearch.
   * Does NOT touch the search query or selected stop.
   */
  function clearNearest() {
    nearest.value = []
    error.value = null
  }

  async function requestLocation(): Promise<void> {
    error.value = null
    if (!import.meta.client || !navigator.geolocation) {
      error.value = 'La géolocalisation n’est pas disponible sur cet appareil.'
      return
    }

    locating.value = true
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          // Ask the device GPS rather than accepting a coarse network fix.
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 15_000,
        })
      })

      const { latitude, longitude, accuracy } = position.coords
      setLocation(latitude, longitude, accuracy)
      // Request ten distinct stations. The wider radius keeps the result count
      // reliable in lower-density areas while results remain distance-sorted.
      await findNearest(latitude, longitude, 10, 20_000)
    }
    catch (reason) {
      const geolocationError = reason as GeolocationPositionError
      if (geolocationError.code === geolocationError.PERMISSION_DENIED) {
        error.value = 'Autorisez l’accès à votre position dans les réglages du navigateur.'
      }
      else if (geolocationError.code === geolocationError.TIMEOUT) {
        error.value = 'Position précise introuvable. Placez-vous près d’une fenêtre puis réessayez.'
      }
      else {
        error.value = 'Votre position est temporairement indisponible.'
      }
    }
    finally {
      locating.value = false
    }
  }

  return { nearest, loading, locating, error, location, requestLocation, findNearest, selectNearby, clearNearest }
}
