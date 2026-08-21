import { describe, expect, it } from 'vitest'
import {
  formatDistanceM,
  formatTime,
  lineStyle,
  relativeArrival,
  statusChipColor,
  statusChipLabel,
} from '~/utils/format'

/** Fixed reference clock so relativeArrival tests are deterministic. */
const NOW = new Date('2026-07-14T10:00:00Z').getTime()
const isoIn = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString()

describe('relativeArrival', () => {
  it('returns "À quai" at 0 min', () => {
    expect(relativeArrival(isoIn(0), NOW)).toBe('À quai')
  })

  it('clamps past arrivals to "À quai"', () => {
    expect(relativeArrival(isoIn(-5), NOW)).toBe('À quai')
  })

  it('uses the singular form at exactly 1 min', () => {
    expect(relativeArrival(isoIn(1), NOW)).toBe('1 min')
  })

  it('returns "12 min" for larger countdowns', () => {
    expect(relativeArrival(isoIn(12), NOW)).toBe('12 min')
  })

  it('rounds 90 seconds up to 2 min', () => {
    expect(relativeArrival(new Date(NOW + 90_000).toISOString(), NOW)).toBe('2 min')
  })
})

describe('formatTime', () => {
  it('formats in Europe/Paris regardless of host timezone (summer, UTC+2)', () => {
    expect(formatTime('2026-07-14T10:00:00Z')).toBe('12:00')
  })

  it('applies the winter CET offset (UTC+1)', () => {
    expect(formatTime('2026-01-14T10:04:00Z')).toBe('11:04')
  })
})

describe('statusChipLabel / statusChipColor', () => {
  it.each([
    ['scheduled', 'Théorique', 'grey'],
    ['estimated', 'Estimé', 'orange'],
    ['live', 'Temps réel', 'green'],
  ] as const)('%s → %s / %s', (status, label, color) => {
    expect(statusChipLabel(status)).toBe(label)
    expect(statusChipColor(status)).toBe(color)
  })
})

describe('formatDistanceM', () => {
  it('rounds metres under 1 km', () => {
    expect(formatDistanceM(249.6)).toBe('250 m')
  })

  it('keeps the metre unit up to 999 m', () => {
    expect(formatDistanceM(999)).toBe('999 m')
  })

  it('switches to km at exactly 1000 m', () => {
    expect(formatDistanceM(1_000)).toBe('1.0 km')
  })

  it('formats km with one decimal', () => {
    expect(formatDistanceM(1_540)).toBe('1.5 km')
  })
})

describe('lineStyle', () => {
  it('uses GTFS colours when provided', () => {
    expect(lineStyle({ routeColor: '2e6db4', routeTextColor: 'ffffff' })).toEqual({
      '--line-color': '#2e6db4',
      '--line-text': '#ffffff',
    })
  })

  it('falls back to CTS red on white for empty colours', () => {
    expect(lineStyle({ routeColor: '', routeTextColor: '' })).toEqual({
      '--line-color': '#c8102e',
      '--line-text': '#ffffff',
    })
  })
})
