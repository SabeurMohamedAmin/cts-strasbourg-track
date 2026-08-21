import { describe, expect, it } from 'vitest'
import { buildMessage, selectTargetTokens, shouldPush } from '~~/server/services/push/disruption-push'

/**
 * server/services/push/disruption-push.ts — the pure parts of the FCM
 * fan-out (ROADMAP_NITRO_API 8.4). The network and database sides are
 * exercised manually against a real FCM project.
 */

const targets = [
  { fcmToken: 'token-a', favoriteLineIds: ['A', 'D'] },
  { fcmToken: 'token-b', favoriteLineIds: ['C'] },
  { fcmToken: 'token-c', favoriteLineIds: [] },
]

describe('push targeting', () => {
  it('targets every device for a network-wide disruption', () => {
    expect(selectTargetTokens([], targets)).toEqual(['token-a', 'token-b', 'token-c'])
  })

  it('targets only devices that favourited an affected line', () => {
    expect(selectTargetTokens(['A'], targets)).toEqual(['token-a'])
  })

  it('matches when any favourite intersects the disruption', () => {
    expect(selectTargetTokens(['C', 'D'], targets)).toEqual(['token-a', 'token-b'])
  })

  it('targets nobody when no device follows the line', () => {
    expect(selectTargetTokens(['Z'], targets)).toEqual([])
  })
})

describe('push severity filter', () => {
  it('buzzes for warning and critical only', () => {
    expect(shouldPush('critical')).toBe(true)
    expect(shouldPush('warning')).toBe(true)
    expect(shouldPush('info')).toBe(false)
  })
})

describe('push payload', () => {
  const row = { id: 42, title: 'Ligne A interrompue', description: 'Trafic interrompu entre Rotonde et Hautepierre.', severity: 'critical' as const }

  it('carries the disruption id and severity for deep-linking', () => {
    expect(buildMessage(row)).toEqual({
      title: 'Ligne A interrompue',
      body: 'Trafic interrompu entre Rotonde et Hautepierre.',
      data: { type: 'disruption', disruptionId: '42', severity: 'critical' },
    })
  })

  it('truncates a long description to stay glanceable', () => {
    const message = buildMessage({ ...row, description: 'x'.repeat(300) })
    expect(message.body).toHaveLength(140)
    expect(message.body.endsWith('\u2026')).toBe(true)
  })
})
