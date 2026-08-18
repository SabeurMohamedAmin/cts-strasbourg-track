import { describe, expect, it } from 'vitest'
import {
  directionQuery,
  lineQuery,
  readDirectionSlug,
  readLineSlug,
  stationQuery,
  toDirectionSlug,
  toLineSlug,
} from '../../app/composables/useStationLines'

describe('toLineSlug', () => {
  it('lowercases and drops everything that is not a letter or a digit', () => {
    expect(toLineSlug('C3')).toBe('c3')
    expect(toLineSlug('c3')).toBe('c3')
    expect(toLineSlug('C 3')).toBe('c3')
    expect(toLineSlug('c-3')).toBe('c3')
    expect(toLineSlug('A')).toBe('a')
    expect(toLineSlug('10')).toBe('10')
  })

  it('treats a missing value as no line', () => {
    expect(toLineSlug()).toBe('')
    expect(toLineSlug('')).toBe('')
  })
})

describe('toDirectionSlug', () => {
  it('normalizes headsigns into kebab-case URL slugs', () => {
    expect(toDirectionSlug('Lingolsheim Alouettes')).toBe('lingolsheim-alouettes')
    expect(toDirectionSlug('Lingolsheim Tiergaertel')).toBe('lingolsheim-tiergaertel')
    expect(toDirectionSlug('Hœnheim Gare')).toBe('hoenheim-gare')
    expect(toDirectionSlug('Étoile Bourse')).toBe('etoile-bourse')
  })

  it('treats a missing value as no direction', () => {
    expect(toDirectionSlug()).toBe('')
    expect(toDirectionSlug('')).toBe('')
  })
})

describe('readLineSlug', () => {
  it('reads ?line and returns it as a slug', () => {
    expect(readLineSlug({ line: 'C3' })).toBe('c3')
    expect(readLineSlug({ line: 'c3' })).toBe('c3')
  })

  it('keeps the first value when the parameter is repeated', () => {
    expect(readLineSlug({ line: ['c3', 'a'] })).toBe('c3')
  })

  it('returns an empty slug when the URL says nothing', () => {
    expect(readLineSlug({})).toBe('')
    expect(readLineSlug({ line: null })).toBe('')
  })
})

describe('readDirectionSlug', () => {
  it('reads ?direction and returns it as a normalized kebab-case slug', () => {
    expect(readDirectionSlug({ direction: 'Lingolsheim Alouettes' })).toBe('lingolsheim-alouettes')
    expect(readDirectionSlug({ direction: 'hoenheim-gare' })).toBe('hoenheim-gare')
    expect(readDirectionSlug({ direction: 'lingolsheimalouettes' })).toBe('lingolsheimalouettes')
  })

  it('returns an empty slug when direction query is absent', () => {
    expect(readDirectionSlug({})).toBe('')
    expect(readDirectionSlug({ direction: null })).toBe('')
  })
})

describe('lineQuery', () => {
  it('builds the query a station link needs', () => {
    expect(lineQuery('C3')).toEqual({ line: 'c3' })
  })

  it('adds nothing to the URL when no line is selected', () => {
    expect(lineQuery()).toBeUndefined()
    expect(lineQuery('')).toBeUndefined()
  })
})

describe('directionQuery', () => {
  it('builds the direction query for station links', () => {
    expect(directionQuery('Lingolsheim Alouettes')).toEqual({ direction: 'lingolsheim-alouettes' })
  })

  it('returns undefined when no direction is provided', () => {
    expect(directionQuery()).toBeUndefined()
    expect(directionQuery('')).toBeUndefined()
  })
})

describe('stationQuery', () => {
  it('combines line and direction query parameters', () => {
    expect(stationQuery('45', 'Lingolsheim Alouettes')).toEqual({
      line: '45',
      direction: 'lingolsheim-alouettes',
    })
  })

  it('handles partial parameters gracefully', () => {
    expect(stationQuery('45')).toEqual({ line: '45' })
    expect(stationQuery(undefined, 'Lingolsheim Alouettes')).toEqual({ direction: 'lingolsheim-alouettes' })
    expect(stationQuery()).toEqual({})
  })
})
