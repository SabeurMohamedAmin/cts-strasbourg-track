import type maplibregl from 'maplibre-gl'
import type { Feature, FeatureCollection, Point } from 'geojson'
import type { LiveVehicle } from '~~/shared/types/vehicle'
import { useVehiclesStore } from '~/stores/vehicles'
import { useLinesStore } from '~/stores/lines'
import { usePageVisibility } from '~/composables/usePageVisibility'
import { initialVehicleTween } from '~/utils/vehicle-tween'

const SOURCE_ID = 'vehicles'
const SHADOW_LAYER_ID = 'vehicle-shadows'
const CIRCLE_LAYER_ID = 'vehicles'
const MARKER_ICON_LAYER_ID = 'vehicle-marker-shapes'
const DIRECTION_LAYER_ID = 'vehicle-directions'
const LABEL_LAYER_ID = 'vehicle-labels'

const DEFAULT_TWEEN_MS = 12_000
const MIN_TWEEN_MS = 3_000
const MAX_TWEEN_MS = 20_000
const MOVEMENT_THRESHOLD_DEG = 0.000_05

const TRAM_ICON = 'cts-tram'
const BUS_ICON = 'cts-bus'
const TRAM_MARKER_ICON = 'cts-tram-marker'
const BUS_MARKER_ICON = 'cts-bus-marker'
const OFM_GLYPH_FALLBACK = 'Noto Sans Regular'

interface AnimatedVehicle {
  prevLon: number
  prevLat: number
  targetLon: number
  targetLat: number
  startedAt: number
  duration: number
  vehicle: LiveVehicle
  lastPushedLon: number
  lastPushedLat: number
  shapePath: [number, number][] | null
}

const EMPTY_COLLECTION: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] }

function buildMarkerShape(mode: 'tram' | 'bus'): ImageData {
  const SIZE = 64
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 5
  ctx.beginPath()
  if (mode === 'tram') {
    ctx.roundRect(5, 5, 54, 54, 12)
  }
  else {
    ctx.arc(32, 32, 27, 0, Math.PI * 2)
  }
  ctx.fill()
  ctx.stroke()
  return ctx.getImageData(0, 0, SIZE, SIZE)
}

function buildVehicleIcon(mode: 'tram' | 'bus'): ImageData {
  const SIZE = 32
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#ffffff'
  ctx.fillStyle = '#ffffff'
  ctx.lineWidth = 2.5

  if (mode === 'tram') {
    ctx.beginPath()
    ctx.moveTo(11, 7)
    ctx.lineTo(16, 2)
    ctx.lineTo(21, 7)
    ctx.stroke()
    ctx.beginPath()
    ctx.roundRect(7, 7, 18, 18, 5)
    ctx.stroke()
    ctx.fillRect(10, 11, 12, 6)
    ctx.beginPath()
    ctx.moveTo(11, 25)
    ctx.lineTo(8, 29)
    ctx.moveTo(21, 25)
    ctx.lineTo(24, 29)
    ctx.stroke()
  }
  else {
    ctx.beginPath()
    ctx.roundRect(7, 4, 18, 22, 6)
    ctx.stroke()
    ctx.beginPath()
    ctx.roundRect(10, 8, 12, 7, 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(11, 22, 2, 0, Math.PI * 2)
    ctx.arc(21, 22, 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(10, 26)
    ctx.lineTo(10, 29)
    ctx.moveTo(22, 26)
    ctx.lineTo(22, 29)
    ctx.stroke()
  }

  return ctx.getImageData(0, 0, SIZE, SIZE)
}

function trimPathFromPosition(
  path: [number, number][],
  lon: number,
  lat: number,
): [number, number][] {
  if (path.length < 2) return path
  let nearestSegment = 0
  let nearestT = 0
  let nearestDistance = Number.POSITIVE_INFINITY
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!
    const b = path[i + 1]!
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const lengthSquared = dx * dx + dy * dy
    const t = lengthSquared > 0
      ? Math.max(0, Math.min(1, ((lon - a[0]) * dx + (lat - a[1]) * dy) / lengthSquared))
      : 0
    const projectedLon = a[0] + dx * t
    const projectedLat = a[1] + dy * t
    const distance = (lon - projectedLon) ** 2 + (lat - projectedLat) ** 2
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestSegment = i
      nearestT = t
    }
  }
  const a = path[nearestSegment]!
  const b = path[nearestSegment + 1]!
  const projected: [number, number] = [
    a[0] + (b[0] - a[0]) * nearestT,
    a[1] + (b[1] - a[1]) * nearestT,
  ]
  return [[lon, lat], projected, ...path.slice(nearestSegment + 1)]
}

function interpolateAlongPath(
  path: [number, number][],
  t: number,
): { lon: number, lat: number } {
  if (path.length < 2) {
    const p = path[0] ?? [0, 0]
    return { lon: p[0], lat: p[1] }
  }
  if (t <= 0) return { lon: path[0]![0], lat: path[0]![1] }
  if (t >= 1) return { lon: path[path.length - 1]![0], lat: path[path.length - 1]![1] }
  let total = 0
  const segLengths: number[] = []
  for (let i = 1; i < path.length; i++) {
    const dx = path[i]![0] - path[i - 1]![0]
    const dy = path[i]![1] - path[i - 1]![1]
    const len = Math.sqrt(dx * dx + dy * dy)
    segLengths.push(len)
    total += len
  }
  if (total === 0) return { lon: path[0]![0], lat: path[0]![1] }
  const target = t * total
  let accumulated = 0
  for (let i = 0; i < segLengths.length; i++) {
    const segLen = segLengths[i]!
    if (accumulated + segLen >= target) {
      const localT = segLen > 0 ? (target - accumulated) / segLen : 0
      const a = path[i]!
      const b = path[i + 1]!
      return { lon: a[0] + (b[0] - a[0]) * localT, lat: a[1] + (b[1] - a[1]) * localT }
    }
    accumulated += segLen
  }
  const last = path[path.length - 1]!
  return { lon: last[0], lat: last[1] }
}

export function useVehicleLayer() {
  const vehiclesStore = useVehiclesStore()
  const linesStore = useLinesStore()
  const { isVisible } = usePageVisibility()

  const animated = new Map<string, AnimatedVehicle>()
  let map: maplibregl.Map | null = null
  let rafId = 0
  let loopRunning = false
  let lastSnapshotAt = 0
  let lastFeatureCount = -1
  let hiddenAt = 0
  let stopWatchingVehicles: (() => void) | null = null
  let stopWatchingSelection: (() => void) | null = null
  let stopWatchingVisibility: (() => void) | null = null

  const lineColors = computed(() => {
    const colors = new Map<string, { color: string, textColor: string }>()
    for (const line of linesStore.lines) {
      colors.set(line.routeId, {
        color: `#${line.routeColor || 'c8102e'}`,
        textColor: `#${line.routeTextColor || 'ffffff'}`,
      })
    }
    return colors
  })

  function interpolate(entry: AnimatedVehicle, now: number): { lon: number, lat: number } {
    const t = Math.min(1, (now - entry.startedAt) / entry.duration)
    if (entry.shapePath && entry.shapePath.length >= 2)
      return interpolateAlongPath(entry.shapePath, t)
    return {
      lon: entry.prevLon + (entry.targetLon - entry.prevLon) * t,
      lat: entry.prevLat + (entry.targetLat - entry.prevLat) * t,
    }
  }

  function onSnapshot(vehicles: LiveVehicle[]) {
    const now = performance.now()
    const sinceLast = lastSnapshotAt ? now - lastSnapshotAt : DEFAULT_TWEEN_MS
    const duration = Math.min(MAX_TWEEN_MS, Math.max(MIN_TWEEN_MS, sinceLast))
    lastSnapshotAt = now
    const seen = new Set<string>()
    for (const vehicle of vehicles) {
      seen.add(vehicle.id)
      const existing = animated.get(vehicle.id)

      // First sighting: there is no previous position to tween from, so the
      // marker used to stand still until the SECOND snapshot (~12 s later).
      // Instead, dead-reckon along the server-provided pathAhead towards the
      // next stop, paced by its ETA — the walk matches the server's own
      // interpolation speed, so the next snapshot's correction stays tiny.
      // Dwelling vehicles ship no pathAhead and correctly stay put.
      if (!existing) {
        const tween = initialVehicleTween(vehicle, Date.now())
        if (tween) {
          const end = tween.path[tween.path.length - 1]!
          animated.set(vehicle.id, {
            prevLon: vehicle.longitude, prevLat: vehicle.latitude,
            targetLon: end[0], targetLat: end[1],
            startedAt: now, duration: tween.durationMs, vehicle,
            lastPushedLon: vehicle.longitude, lastPushedLat: vehicle.latitude,
            shapePath: tween.path,
          })
          continue
        }
      }

      const from = existing ? interpolate(existing, now) : { lon: vehicle.longitude, lat: vehicle.latitude }
      const shapePath = vehicle.shapePath && vehicle.shapePath.length >= 2
        ? trimPathFromPosition(vehicle.shapePath, from.lon, from.lat)
        : null
      animated.set(vehicle.id, {
        prevLon: from.lon, prevLat: from.lat,
        targetLon: vehicle.longitude, targetLat: vehicle.latitude,
        startedAt: now, duration, vehicle,
        lastPushedLon: existing?.lastPushedLon ?? from.lon,
        lastPushedLat: existing?.lastPushedLat ?? from.lat,
        shapePath,
      })
    }
    for (const id of [...animated.keys()]) {
      if (!seen.has(id)) animated.delete(id)
    }
  }

  function frame() {
    if (!loopRunning) return
    const source = map?.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    if (source) {
      const now = performance.now()
      const features: Feature<Point>[] = []
      let dirty = false
      for (const entry of animated.values()) {
        if (!linesStore.activeLineIds.has(entry.vehicle.lineId)) continue
        const { lon, lat } = interpolate(entry, now)
        const dLon = Math.abs(lon - entry.lastPushedLon)
        const dLat = Math.abs(lat - entry.lastPushedLat)
        if (dLon > MOVEMENT_THRESHOLD_DEG || dLat > MOVEMENT_THRESHOLD_DEG) {
          dirty = true
          entry.lastPushedLon = lon
          entry.lastPushedLat = lat
        }
        const style = lineColors.value.get(entry.vehicle.lineId)
        features.push({
          type: 'Feature',
          properties: {
            id: entry.vehicle.id,
            label: entry.vehicle.lineLabel,
            color: style?.color ?? '#c8102e',
            textColor: style?.textColor ?? '#ffffff',
            bearing: entry.vehicle.bearing ?? 0,
            mode: entry.vehicle.mode ?? 'bus',
            selected: entry.vehicle.id === vehiclesStore.selectedVehicleId,
          },
          geometry: { type: 'Point', coordinates: [lon, lat] },
        })
      }
      if (dirty || features.length !== lastFeatureCount) {
        source.setData({ type: 'FeatureCollection', features })
        lastFeatureCount = features.length
      }
    }
    rafId = requestAnimationFrame(frame)
  }

  function startLoop() {
    if (loopRunning) return
    loopRunning = true
    rafId = requestAnimationFrame(frame)
  }

  function stopLoop() {
    loopRunning = false
    cancelAnimationFrame(rafId)
    rafId = 0
  }

  function resetTweenClocksAfterHide() {
    if (!hiddenAt) return
    const now = performance.now()
    hiddenAt = 0
    for (const [id, entry] of animated) {
      const current = interpolate(entry, now)
      animated.set(id, { ...entry, prevLon: current.lon, prevLat: current.lat, startedAt: now, duration: Math.max(MIN_TWEEN_MS, DEFAULT_TWEEN_MS) })
    }
  }

  function registerIcons(mapInstance: maplibregl.Map) {
    const tramImg = buildVehicleIcon('tram')
    if (!mapInstance.hasImage(TRAM_ICON)) mapInstance.addImage(TRAM_ICON, tramImg, { pixelRatio: 2 })
    const busImg = buildVehicleIcon('bus')
    if (!mapInstance.hasImage(BUS_ICON)) mapInstance.addImage(BUS_ICON, busImg, { pixelRatio: 2 })
    const tramMarker = buildMarkerShape('tram')
    if (!mapInstance.hasImage(TRAM_MARKER_ICON))
      mapInstance.addImage(TRAM_MARKER_ICON, tramMarker, { pixelRatio: 2, sdf: true })
    const busMarker = buildMarkerShape('bus')
    if (!mapInstance.hasImage(BUS_MARKER_ICON))
      mapInstance.addImage(BUS_MARKER_ICON, busMarker, { pixelRatio: 2, sdf: true })
  }

  function attach(mapInstance: maplibregl.Map) {
    // Idempotence guard: the initial 'load' handler can race the debounced
    // theme-reload path, reaching attach() twice for the same style. If our
    // source is already on this style the layers are too — this call is
    // redundant, so bail out instead of crashing on addSource.
    if (mapInstance.getSource(SOURCE_ID)) return
    // A previous attach (before a style swap) may have left watchers and the
    // RAF loop running — detach first so they never stack.
    if (map) detach()

    map = mapInstance
    registerIcons(map)

    map.addSource(SOURCE_ID, { type: 'geojson', data: EMPTY_COLLECTION })

    map.addLayer({
      id: SHADOW_LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      paint: {
        'circle-color': '#101828',
        'circle-radius': ['case', ['get', 'selected'], 19, 15],
        'circle-blur': 0.65,
        'circle-opacity': 0.32,
        'circle-translate': [0, 2],
      },
    })

    map.addLayer({
      id: CIRCLE_LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      paint: {
        'circle-color': 'transparent',
        'circle-radius': ['case', ['get', 'selected'], 22, 18],
      },
    })

    map.addLayer({
      id: MARKER_ICON_LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      layout: {
        'icon-image': ['match', ['get', 'mode'], 'tram', TRAM_MARKER_ICON, BUS_MARKER_ICON],
        'icon-size': [
          'interpolate', ['linear'], ['zoom'],
          9, ['case', ['get', 'selected'], 0.76, 0.62],
          15, ['case', ['get', 'selected'], 0.98, 0.82],
        ],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: {
        'icon-color': ['get', 'color'],
        'icon-halo-color': '#ffffff',
        'icon-halo-width': ['case', ['get', 'selected'], 3, 1.5],
      },
    })

    map.addLayer({
      id: DIRECTION_LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      layout: {
        'text-field': '▲',
        'text-size': 8,
        'text-rotate': ['get', 'bearing'],
        'text-rotation-alignment': 'map',
        'text-allow-overlap': true,
        'text-offset': [0, -2.85],
      },
      paint: {
        'text-color': ['get', 'color'],
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
      },
    })

    map.addLayer({
      id: 'vehicle-mode-icons',
      type: 'symbol',
      source: SOURCE_ID,
      minzoom: 10,
      layout: {
        'icon-image': ['match', ['get', 'mode'], 'tram', TRAM_ICON, BUS_ICON],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.62, 15, 0.86],
        'icon-offset': [0, -8],
        'icon-anchor': 'center',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-rotation-alignment': 'viewport',
      },
    })

    map.addLayer({
      id: LABEL_LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 9, 11, 15, 15],
        'text-font': [OFM_GLYPH_FALLBACK],
        'text-offset': [0, 0.68],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': ['get', 'textColor'],
        'text-halo-color': ['get', 'color'],
        'text-halo-width': 1.5,
      },
    })

    map.on('click', CIRCLE_LAYER_ID, (event) => {
      const id = event.features?.[0]?.properties?.id
      if (typeof id === 'string') vehiclesStore.selectVehicle(id)
    })
    map.on('mouseenter', CIRCLE_LAYER_ID, () => { map!.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', CIRCLE_LAYER_ID, () => { map!.getCanvas().style.cursor = '' })

    stopWatchingVehicles = watch(
      () => vehiclesStore.vehicles,
      onSnapshot,
      { immediate: true },
    )
    stopWatchingSelection = watch(
      () => vehiclesStore.selectedVehicleId,
      (vehicleId) => {
        if (!vehicleId || !map) return
        const entry = animated.get(vehicleId)
        if (!entry) return
        const pos = interpolate(entry, performance.now())
        map.easeTo({ center: [pos.lon, pos.lat], zoom: Math.max(map.getZoom(), 15) })
      },
    )
    stopWatchingVisibility = watch(isVisible, (visible) => {
      if (visible) { resetTweenClocksAfterHide(); startLoop() }
      else { hiddenAt = performance.now(); stopLoop() }
    })

    startLoop()
  }

  function detach() {
    stopLoop()
    stopWatchingVehicles?.()
    stopWatchingSelection?.()
    stopWatchingVisibility?.()
    stopWatchingVehicles = null
    stopWatchingSelection = null
    stopWatchingVisibility = null
    animated.clear()
    lastFeatureCount = -1
    map = null
  }

  return { attach, detach }
}
