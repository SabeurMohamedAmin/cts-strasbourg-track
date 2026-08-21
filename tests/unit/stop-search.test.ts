import { describe, it, expect } from 'vitest'
import { groupStopDirections, normalizeSearchText, searchStops } from '../../app/utils/stopSearch'

/**
 * Unit tests for the stop search helpers.
 *
 * The critical behaviours:
 *   - accent/case-insensitive matching (users type without accents)
 *   - ranking: prefix matches must beat word-start and substring matches
 *   - the result limit is respected
 */

const stop = (stopName: string) => ({ stopName })

describe('normalizeSearchText', () => {
  it('lowercases and strips accents', () => {
    expect(normalizeSearchText('République')).toBe('republique')
  })

  it('treats apostrophes and hyphens as word separators', () => {
    expect(normalizeSearchText("L'Étoile-Bourse")).toBe('l etoile bourse')
  })

  it('collapses repeated whitespace and trims', () => {
    expect(normalizeSearchText('  Homme   de  Fer ')).toBe('homme de fer')
  })
})

describe('groupStopDirections', () => {
  it('combines opposite platforms and merges their transport metadata', () => {
    const platforms = [
      { stopId: 'a-1', stopName: 'République', parentStation: 'a', routes: ['A'], modes: ['tram'] },
      { stopId: 'a-2', stopName: 'République', parentStation: 'a', routes: ['C'], modes: ['tram', 'bus'] },
    ]

    expect(groupStopDirections(platforms)).toEqual([
      { stopId: 'a-1', stopName: 'République', parentStation: 'a', routes: ['A', 'C'], modes: ['tram', 'bus'] },
    ])
  })

  it('uses the normalized stop name when parent station data is missing', () => {
    const platforms = [
      { stopId: '1', stopName: 'Étoile Bourse', routes: ['A'] },
      { stopId: '2', stopName: 'Etoile Bourse', routes: ['D'] },
    ]

    expect(groupStopDirections(platforms)).toHaveLength(1)
  })
})

describe('searchStops', () => {
  const stops = [
    stop('République'),
    stop('Homme de Fer'),
    stop('Gare Centrale'),
    stop('Ferme Bussière'),
    stop('Rotonde'),
  ]

  it('returns an empty list for an empty or whitespace query', () => {
    expect(searchStops(stops, '')).toEqual([])
    expect(searchStops(stops, '   ')).toEqual([])
  })

  it('matches regardless of accents and case', () => {
    expect(searchStops(stops, 'REPUBLIQUE')).toEqual([stop('République')])
  })

  it('ranks prefix matches before word-start matches', () => {
    const names = searchStops(stops, 'fer').map(s => s.stopName)
    // 'Ferme Bussière' starts with the query; 'Homme de Fer' matches a word.
    expect(names).toEqual(['Ferme Bussière', 'Homme de Fer'])
  })

  it('matches multiple words when connector words are omitted', () => {
    expect(searchStops(stops, 'homme fer')).toEqual([stop('Homme de Fer')])
  })

  it('excludes stops that do not match at all', () => {
    expect(searchStops(stops, 'zzz')).toEqual([])
  })

  it('ignores one-character queries to avoid noisy results', () => {
    expect(searchStops(stops, 'e')).toEqual([])
  })

  it('respects the result limit', () => {
    expect(searchStops(stops, 're', 1)).toHaveLength(1)
  })

  it('can find a station by an exact route label', () => {
    const routedStops = [
      { stopName: 'Homme de Fer', routes: ['A', 'D'] },
      { stopName: 'République', routes: ['B', 'C'] },
    ]
    expect(searchStops(routedStops, 'd')).toEqual([])
    expect(searchStops(routedStops, '10')).toEqual([])
    expect(searchStops([{ stopName: 'Gare', routes: ['L1'] }], 'L1'))
      .toEqual([{ stopName: 'Gare', routes: ['L1'] }])
  })
})
