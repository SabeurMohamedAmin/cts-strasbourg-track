import { describe, expect, it } from 'vitest'
import { lineQuery, readLineSlug, toLineSlug } from '../../app/composables/useStationLines'

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

describe('lineQuery', () => {
  it('builds the query a station link needs', () => {
    expect(lineQuery('C3')).toEqual({ line: 'c3' })
  })

  it('adds nothing to the URL when no line is selected', () => {
    expect(lineQuery()).toBeUndefined()
    expect(lineQuery('')).toBeUndefined()
  })
})
