// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import ConnectionStatusChip from '~/components/ui/ConnectionStatusChip.vue'
import { mountWithVuetify } from './test-utils'

/**
 * Rendering contract test for ConnectionStatusChip (Phase 5).
 *
 * The component is SELF-HANDLING: it derives its state from
 * useConnectionStatus(). We mock the composable so the test stays a
 * pure rendering contract — no Pinia store or SSE stream required.
 */
vi.mock('~/composables/useConnectionStatus', () => ({
  useConnectionStatus: () => ({
    connectionLabel: computed(() => 'Temps réel'),
    connectionIcon: computed(() => 'mdi-access-point'),
    connectionColor: computed(() => 'success'),
  }),
}))

describe('ConnectionStatusChip', () => {
  it('renders the label in the row and inside the chip', () => {
    const wrapper = mountWithVuetify(ConnectionStatusChip)
    expect(wrapper.text()).toContain('Temps réel')
    expect(wrapper.find('.v-chip').text()).toBe('Temps réel')
  })

  it('applies the icon and color from the composable', () => {
    const wrapper = mountWithVuetify(ConnectionStatusChip)
    expect(wrapper.find('.v-icon').classes()).toContain('mdi-access-point')
    expect(wrapper.find('.v-chip').classes()).toContain('text-success')
  })
})
