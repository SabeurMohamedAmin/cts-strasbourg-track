// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import type { StopArrival } from '~~/shared/types/stop'
import ArrivalRow from '~/components/stops/ArrivalRow.vue'
import { mountWithVuetify } from './test-utils'

/**
 * Props contract test for ArrivalRow (Phase 5).
 * Rendering relies on the pure formatters from app/utils/format.ts,
 * which have their own dedicated unit tests.
 */
describe('ArrivalRow', () => {
  function makeArrival(overrides: Partial<StopArrival> = {}): StopArrival {
    return {
      tripId: 'trip-1',
      lineLabel: 'A',
      destination: 'Illkirch Graffenstaden',
      // 5 minutes ahead so relativeArrival renders a countdown.
      scheduledArrival: new Date(Date.now() + 5 * 60_000).toISOString(),
      mode: 'tram',
      routeColor: 'c8102e',
      routeTextColor: 'ffffff',
      status: 'live',
      ...overrides,
    }
  }

  it('renders line badge, destination and mode', () => {
    const wrapper = mountWithVuetify(ArrivalRow, { props: { arrival: makeArrival() } })
    expect(wrapper.find('.v-avatar').text()).toBe('A')
    expect(wrapper.text()).toContain('Illkirch Graffenstaden')
    expect(wrapper.text()).toContain('Tram')
  })

  it('renders the countdown and the data-source chip', () => {
    const wrapper = mountWithVuetify(ArrivalRow, { props: { arrival: makeArrival() } })
    expect(wrapper.text()).toMatch(/\d+ min/)
    expect(wrapper.find('.v-chip').text()).toBe('Temps réel')
  })

  it('labels scheduled data as theoretical', () => {
    const wrapper = mountWithVuetify(ArrivalRow, {
      props: { arrival: makeArrival({ status: 'scheduled', mode: 'bus' }) },
    })
    expect(wrapper.find('.v-chip').text()).toBe('Théorique')
    expect(wrapper.text()).toContain('Bus')
  })

  it('highlights the very next departure via is-next', () => {
    const wrapper = mountWithVuetify(ArrivalRow, {
      props: { arrival: makeArrival(), isNext: true },
    })
    expect(wrapper.find('.arrival-item').classes()).toContain('arrival-item--next')
  })
})
