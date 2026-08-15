import { describe, expect, it } from 'vitest'
import { OFM_GLYPH_FALLBACK } from '~/utils/map-constants'
import {
  routeLineLayers,
  selectedStopRingLayer,
  stopClusterCountLayer,
  stopClusterLayer,
  unclusteredStopsLayer,
} from '~/utils/map-layers'

describe('stopClusterLayer', () => {
  it('targets clustered points on the stops source', () => {
    const layer = stopClusterLayer()
    expect(layer.id).toBe('stop-clusters')
    expect(layer.source).toBe('stops')
    expect(layer.filter).toEqual(['has', 'point_count'])
  })

  it('starts hidden (visibility toggled by StopToggleButtons)', () => {
    expect(stopClusterLayer().layout?.visibility).toBe('none')
  })
})

describe('stopClusterCountLayer', () => {
  it('renders the count over clusters with the glyph-safe font', () => {
    const layer = stopClusterCountLayer()
    expect(layer.id).toBe('stop-cluster-count')
    expect(layer.source).toBe('stops')
    expect(layer.filter).toEqual(['has', 'point_count'])
    expect(layer.layout?.['text-font']).toEqual([OFM_GLYPH_FALLBACK])
    expect(layer.layout?.visibility).toBe('none')
  })
})

describe('unclusteredStopsLayer', () => {
  it('targets only non-clustered points and starts hidden', () => {
    const layer = unclusteredStopsLayer()
    expect(layer.id).toBe('unclustered-stops')
    expect(layer.filter).toEqual(['!', ['has', 'point_count']])
    expect(layer.layout?.visibility).toBe('none')
  })

  it('drives ring color and width from the favourite flag', () => {
    const paint = unclusteredStopsLayer().paint
    expect(paint?.['circle-stroke-color']).toEqual(['case', ['get', 'favourite'], '#f59e0b', '#c8102e'])
    expect(paint?.['circle-stroke-width']).toEqual(['case', ['get', 'favourite'], 3, 2])
  })
})

describe('selectedStopRingLayer', () => {
  it('matches no stop initially (empty id filter)', () => {
    const layer = selectedStopRingLayer()
    expect(layer.id).toBe('selected-stop-ring')
    expect(layer.filter).toEqual(['==', ['get', 'id'], ''])
  })
})

describe('routeLineLayers', () => {
  it('returns [glow, line] in draw order with matching ids and source', () => {
    const [glow, line] = routeLineLayers('A', 'FF0000', true)
    expect(glow.id).toBe('route-A-glow')
    expect(line.id).toBe('route-A')
    expect(glow.source).toBe('route-A')
    expect(line.source).toBe('route-A')
  })

  it('prefixes the GTFS hex color with # on both layers', () => {
    const [glow, line] = routeLineLayers('A', 'FF0000', true)
    expect(glow.paint?.['line-color']).toBe('#FF0000')
    expect(line.paint?.['line-color']).toBe('#FF0000')
  })

  it('maps visible=true to "visible"', () => {
    for (const layer of routeLineLayers('A', 'FF0000', true)) {
      expect(layer.layout?.visibility).toBe('visible')
    }
  })

  it('maps visible=false to "none"', () => {
    for (const layer of routeLineLayers('A', 'FF0000', false)) {
      expect(layer.layout?.visibility).toBe('none')
    }
  })
})
