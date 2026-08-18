import { describe, expect, it } from 'vitest'
import { getLineFromQuery, normalizeLineSlug } from '../../app/composables/useStationLines'

describe('normalizeLineSlug', () => {
  it('lowercases and strips spaces and special characters', () => {
    expect(normalizeLineSlug('C3')).toBe('c3')
    expect(normalizeLineSlug('c3')).toBe('c3')
    expect(normalizeLineSlug('C 3')).toBe('c3')
    expect(normalizeLineSlug('c-3')).toBe('c3')
    expect(normalizeLineSlug('A')).toBe('a')
    expect(normalizeLineSlug('10')).toBe('10')
  })
})

describe('getLineFromQuery', () => {
  it('extracts line parameter from line', () => {
    expect(getLineFromQuery({ line: 'C3' })).toBe('C3')
  })

  it('extracts line parameter from ligne', () => {
    expect(getLineFromQuery({ ligne: 'c1' })).toBe('c1')
  })

  it('extracts line parameter from selected-line or slected-ligne', () => {
    expect(getLineFromQuery({ 'selected-line': 'C3' })).toBe('C3')
    expect(getLineFromQuery({ 'slected-ligne': 'c3' })).toBe('c3')
  })

  it('decodes encoded URL components', () => {
    expect(getLineFromQuery({ line: '%43%33' })).toBe('C3')
  })

  it('returns empty string if no line parameter is present', () => {
    expect(getLineFromQuery({})).toBe('')
  })
})
