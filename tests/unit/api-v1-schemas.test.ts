import { describe, expect, it } from 'vitest'
import { deviceRegistrationSchema, trackEventSchema } from '~~/shared/schemas/api-v1'

/**
 * Validation rules for the public v1 WRITE endpoints (Step 8).
 * These schemas are the contract the Flutter app posts against — a regression
 * here is a breaking change, so the rules are pinned by test.
 */

describe('deviceRegistrationSchema (POST /api/v1/devices)', () => {
  it('accepts a valid registration', () => {
    const parsed = deviceRegistrationSchema.parse({
      fcmToken: 'fcm-token-123',
      platform: 'android',
      favoriteLineIds: ['A', 'C6'],
    })
    expect(parsed.platform).toBe('android')
    expect(parsed.favoriteLineIds).toEqual(['A', 'C6'])
  })

  it('defaults favoriteLineIds to an empty array', () => {
    const parsed = deviceRegistrationSchema.parse({ fcmToken: 't', platform: 'ios' })
    expect(parsed.favoriteLineIds).toEqual([])
  })

  it('rejects an unknown platform', () => {
    expect(() => deviceRegistrationSchema.parse({ fcmToken: 't', platform: 'web' })).toThrow()
  })

  it('rejects an empty FCM token', () => {
    expect(() => deviceRegistrationSchema.parse({ fcmToken: '', platform: 'ios' })).toThrow()
  })
})

describe('trackEventSchema (POST /api/v1/track)', () => {
  it('accepts a minimal event', () => {
    const parsed = trackEventSchema.parse({ event: 'map_opened', platform: 'web' })
    expect(parsed.event).toBe('map_opened')
  })

  it('accepts a small property bag', () => {
    const parsed = trackEventSchema.parse({
      event: 'stop_viewed',
      platform: 'android',
      properties: { stopId: '23NOV_01', rank: 1, cached: true },
    })
    expect(parsed.properties?.stopId).toBe('23NOV_01')
  })

  it('rejects an unknown platform', () => {
    expect(() => trackEventSchema.parse({ event: 'x', platform: 'desktop' })).toThrow()
  })

  it('rejects a missing event name', () => {
    expect(() => trackEventSchema.parse({ event: '', platform: 'ios' })).toThrow()
  })
})
