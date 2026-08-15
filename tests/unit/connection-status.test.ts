import { describe, expect, it } from 'vitest'
import { resolveConnectionStatus } from '~/utils/connection-status'

/**
 * Unit tests for the connection status mapping table (Step 4.2).
 * Pure function — no store, no Nuxt runtime needed.
 */
describe('resolveConnectionStatus', () => {
  it('maps connecting to a grey sync indicator', () => {
    expect(resolveConnectionStatus('connecting', 'live', false)).toEqual({
      label: 'Connexion…',
      icon: 'mdi-wifi-sync',
      color: 'grey',
    })
  })

  it('maps reconnecting to an offline error indicator', () => {
    expect(resolveConnectionStatus('reconnecting', 'live', false)).toEqual({
      label: 'Hors ligne',
      icon: 'mdi-wifi-off',
      color: 'error',
    })
  })

  it('maps scheduled-only data to the timetable indicator', () => {
    expect(resolveConnectionStatus('open', 'live', true)).toEqual({
      label: 'Horaires théoriques',
      icon: 'mdi-calendar-clock',
      color: 'info',
    })
  })

  it('maps open + live to the real-time indicator', () => {
    expect(resolveConnectionStatus('open', 'live', false)).toEqual({
      label: 'Temps réel',
      icon: 'mdi-access-point',
      color: 'success',
    })
  })

  it('maps open + stale to the aging-data warning', () => {
    expect(resolveConnectionStatus('open', 'stale', false)).toEqual({
      label: 'Données anciennes',
      icon: 'mdi-wifi-alert',
      color: 'warning',
    })
  })

  it('gives connecting priority over scheduled data', () => {
    expect(resolveConnectionStatus('connecting', 'live', true).label).toBe('Connexion…')
  })

  it('gives reconnecting priority over scheduled data', () => {
    expect(resolveConnectionStatus('reconnecting', 'stale', true).label).toBe('Hors ligne')
  })

  it('gives scheduled data priority over freshness', () => {
    expect(resolveConnectionStatus('open', 'stale', true).label).toBe('Horaires théoriques')
  })
})
