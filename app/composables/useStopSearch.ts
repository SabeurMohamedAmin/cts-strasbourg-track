import { useStopsStore } from '~/stores/stops'

export function useStopSearch() {
  const stopsStore = useStopsStore()
  const query = ref('')

  watchEffect(() => {
    stopsStore.searchQuery = query.value
  })

  return {
    query,
    /**
     * Wrapped in computed() on purpose.
     *
     * `stopsStore.filteredStops` (property access on the store instance)
     * UNWRAPS the store computed and returns a plain array — a one-time
     * snapshot that is neither reactive nor usable as `results.value`
     * in consumer scripts (AppDrawer / StopSearch keyboard navigation).
     *
     * The computed re-reads the store on every change, stays reactive,
     * supports `.value` in <script> and auto-unwraps in templates.
     */
    results: computed(() => stopsStore.filteredStops),
  }
}
