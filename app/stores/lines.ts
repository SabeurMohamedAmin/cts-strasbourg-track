import { defineStore } from 'pinia'
import type { MultiLineString } from 'geojson'

/** One route geometry as served by GET /api/routes/shapes. */
export interface RouteShape {
  routeId: string
  routeColor: string
  geometry: MultiLineString
}

interface Route {
  routeId: string
  routeShortName: string
  routeLongName: string | null
  routeType: number // 0=tram, 3=bus
  routeColor: string
  routeTextColor: string
}

export const useLinesStore = defineStore('lines', () => {
  const lines = ref<Route[]>([])
  const activeLineIds = ref<Set<string>>(new Set())
  const activeModes = ref<Array<'tram' | 'bus'>>(['tram'])

  /** Route geometries, fetched once and shared by every map layer. */
  const shapes = ref<RouteShape[]>([])
  let shapesPromise: Promise<RouteShape[]> | null = null

  async function fetchLines() {
    if (lines.value.length) return
    const data = await $fetch<Route[]>('/api/routes')
    lines.value = data
    if (!restoreFilters()) setModeLines('tram', true)
  }

  /**
   * Fetch all route geometries once. The in-flight promise is shared so the
   * network layers and the route-highlight layer never double-request, and
   * it is reset on failure so a later call can retry with a fresh request.
   */
  async function fetchShapes(): Promise<RouteShape[]> {
    if (shapes.value.length) return shapes.value
    shapesPromise ??= $fetch<RouteShape[]>('/api/routes/shapes')
    try {
      shapes.value = await shapesPromise
    }
    catch (error) {
      shapesPromise = null
      throw error
    }
    return shapes.value
  }

  function restoreFilters(): boolean {
    if (!import.meta.client) return false
    try {
      const saved = JSON.parse(localStorage.getItem('cts-line-filters') ?? 'null')
      if (!saved || !Array.isArray(saved.modes) || !Array.isArray(saved.lineIds)) return false

      const validModes = saved.modes.filter((mode: unknown): mode is 'tram' | 'bus' =>
        mode === 'tram' || mode === 'bus',
      )
      const validRouteIds = new Set(lines.value.map(route => route.routeId))
      activeModes.value = [...new Set(validModes)]
      activeLineIds.value = new Set(
        saved.lineIds.filter((id: unknown): id is string =>
          typeof id === 'string' && validRouteIds.has(id),
        ),
      )
      return true
    }
    catch {
      localStorage.removeItem('cts-line-filters')
      return false
    }
  }

  function persistFilters() {
    if (!import.meta.client) return
    localStorage.setItem('cts-line-filters', JSON.stringify({
      modes: activeModes.value,
      lineIds: [...activeLineIds.value],
    }))
  }

  function modeForRoute(route: Route): 'tram' | 'bus' | null {
    if (route.routeType === 0) return 'tram'
    if (route.routeType === 3) return 'bus'
    return null
  }

  /** Internal helper — add/remove all line IDs belonging to a mode. */
  function setModeLines(mode: 'tram' | 'bus', active: boolean) {
    for (const route of lines.value) {
      if (modeForRoute(route) !== mode) continue
      if (active) activeLineIds.value.add(route.routeId)
      else activeLineIds.value.delete(route.routeId)
    }
  }

  /** Ensure `mode` is present in activeModes (idempotent). */
  function enableMode(mode: 'tram' | 'bus') {
    if (!activeModes.value.includes(mode)) activeModes.value.push(mode)
  }

  /** Remove `mode` from activeModes (idempotent). */
  function disableMode(mode: 'tram' | 'bus') {
    const idx = activeModes.value.indexOf(mode)
    if (idx !== -1) activeModes.value.splice(idx, 1)
  }

  /**
   * Bulk-select ALL lines for a mode.
   * Also activates the mode button if it was off.
   * Calls persistFilters() exactly once.
   */
  function selectAllInMode(mode: 'tram' | 'bus') {
    enableMode(mode)
    setModeLines(mode, true)
    persistFilters()
  }

  /**
   * Deselect every line belonging to a mode without disabling the mode itself.
   */
  function deselectAllInMode(mode: 'tram' | 'bus') {
    enableMode(mode)
    setModeLines(mode, false)
    persistFilters()
  }

  /** Set a single line explicitly and keep its transport mode consistent. */
  function setLineVisible(routeId: string, visible: boolean) {
    const route = lines.value.find(line => line.routeId === routeId)
    if (!route) return

    if (visible) {
      activeLineIds.value.add(routeId)
      const mode = modeForRoute(route)
      if (mode) enableMode(mode)
    }
    else {
      activeLineIds.value.delete(routeId)
    }
    persistFilters()
  }

  /** Toggle a single line on/off. */
  function toggleLine(routeId: string) {
    setLineVisible(routeId, !activeLineIds.value.has(routeId))
  }

  /**
   * Toggle an entire transport mode on/off.
   * Activating a mode also activates all its lines.
   * Deactivating a mode also removes all its line IDs.
   */
  function toggleMode(mode: 'tram' | 'bus') {
    const enabling = !activeModes.value.includes(mode)
    if (enabling) enableMode(mode)
    else disableMode(mode)
    setModeLines(mode, enabling)
    persistFilters()
  }

  function toggleAllVisible() {
    const visibleRoutes = lines.value.filter((route) => {
      const mode = modeForRoute(route)
      return mode !== null && activeModes.value.includes(mode)
    })
    const enableAll = visibleRoutes.some(route => !activeLineIds.value.has(route.routeId))
    for (const route of visibleRoutes) {
      if (enableAll) activeLineIds.value.add(route.routeId)
      else activeLineIds.value.delete(route.routeId)
    }
    persistFilters()
  }

  function isActive(routeId: string) {
    return activeLineIds.value.has(routeId)
  }

  return {
    lines,
    shapes,
    activeLineIds,
    activeModes,
    fetchLines,
    fetchShapes,
    setLineVisible,
    toggleLine,
    toggleMode,
    selectAllInMode,
    deselectAllInMode,
    toggleAllVisible,
    isActive,
  }
})
