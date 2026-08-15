/**
 * useAddressSearch — geocodes free text (addresses, streets, cities) through
 * our /api/geocode proxy (French national address database — BAN).
 *
 * Mirrors the useStopSearch shape (query in, results out) so StopSearch can
 * drive both searches from the same debounced input.
 *
 * A monotonically increasing request id guards against out-of-order network
 * responses: only the latest request is allowed to write results.
 */
import type { GeocodeResult } from '~~/shared/types/geocode'

const clientAddressCache = new Map<string, GeocodeResult[]>()

export function useAddressSearch() {
  const query = ref('')
  const results = ref<GeocodeResult[]>([])
  const loading = ref(false)

  let requestId = 0

  watch(query, async (value) => {
    const id = ++requestId
    const q = value.trim().toLowerCase()

    // The geocoding API needs at least 3 characters — clear and bail early.
    if (q.length < 3) {
      results.value = []
      loading.value = false
      return
    }

    const cached = clientAddressCache.get(q)
    if (cached) {
      results.value = cached
      loading.value = false
      return
    }

    loading.value = true
    try {
      const data = await $fetch<GeocodeResult[]>('/api/geocode', { query: { q } })
      if (id !== requestId) return // stale response — a newer query is in flight
      clientAddressCache.set(q, data)
      results.value = data
    }
    catch {
      // Network / 502 errors: fail quietly, the stop search still works.
      if (id === requestId) results.value = []
    }
    finally {
      if (id === requestId) loading.value = false
    }
  })

  return { query, results, loading }
}
