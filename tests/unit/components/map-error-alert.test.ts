// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import MapErrorAlert from '~/components/map/MapErrorAlert.vue'
import { mountWithVuetify } from './test-utils'

/**
 * Props/emits contract test for MapErrorAlert (Phase 5).
 *   props: message
 *   emits: retry, close
 */
describe('MapErrorAlert', () => {
  const message = 'Impossible de charger le réseau.'

  it('renders the error message', () => {
    const wrapper = mountWithVuetify(MapErrorAlert, { props: { message } })
    expect(wrapper.text()).toContain(message)
    expect(wrapper.text()).toContain('Oups !')
  })

  it('emits retry when the retry button is clicked', async () => {
    const wrapper = mountWithVuetify(MapErrorAlert, { props: { message } })
    const retryButton = wrapper
      .findAll('button')
      .find(button => button.text().includes('Réessayer'))
    expect(retryButton).toBeDefined()
    await retryButton!.trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('emits close when the alert is dismissed', async () => {
    const wrapper = mountWithVuetify(MapErrorAlert, { props: { message } })
    // The closable alert renders exactly one other button: the close action.
    const closeButton = wrapper
      .findAll('button')
      .find(button => !button.text().includes('Réessayer'))
    expect(closeButton).toBeDefined()
    await closeButton!.trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
