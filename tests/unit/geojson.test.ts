import { describe, expect, it } from 'vitest'
import { buildStopFeatureCollection } from '~/utils/geojson'

/** Minimal fixtures — only the four fields the builder needs. */
const stops = [
  { stopId: 'HOMME_FER', stopName: 'Homme de Fer', stopLat: 48.5834, stopLon: 7.7455 },
  { stopId: 'GARE', stopName: 'Gare Centrale', stopLat: 48.5851, stopLon: 7.7349 },
]

describe('buildStopFeatureCollection', () => {
  it('returns an empty FeatureCollection for an empty stop list', () => {
    const fc = buildStopFeatureCollection([], new Set())
    expect(fc).toEqual({ type: 'FeatureCollection', features: [] })
  })

  it('emits coordinates in GeoJSON [lon, lat] order', () => {
    const fc = buildStopFeatureCollection(stops, new Set())
    expect(fc.features[0]!.geometry.coordinates).toEqual([7.7455, 48.5834])
    expect(fc.features[1]!.geometry.coordinates).toEqual([7.7349, 48.5851])
  })

  it('copies id and name into feature properties', () => {
    const fc = buildStopFeatureCollection(stops, new Set())
    expect(fc.features[0]!.properties).toMatchObject({
      id: 'HOMME_FER',
      name: 'Homme de Fer',
    })
  })

  it('flags favourites correctly', () => {
    const fc = buildStopFeatureCollection(stops, new Set(['GARE']))
    expect(fc.features[0]!.properties!.favourite).toBe(false)
    expect(fc.features[1]!.properties!.favourite).toBe(true)
  })

  it('flags nothing when the favourite set is empty', () => {
    const fc = buildStopFeatureCollection(stops, new Set())
    for (const feature of fc.features) {
      expect(feature.properties!.favourite).toBe(false)
    }
  })

  it('ignores favourite ids that are not in the stop list', () => {
    const fc = buildStopFeatureCollection(stops, new Set(['UNKNOWN_STOP']))
    expect(fc.features.every(f => f.properties!.favourite === false)).toBe(true)
  })
})
