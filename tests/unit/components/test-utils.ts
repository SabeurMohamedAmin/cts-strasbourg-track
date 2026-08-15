import { mount, type ComponentMountingOptions } from '@vue/test-utils'
import type { Component } from 'vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

// happy-dom does not implement ResizeObserver, which some Vuetify
// components observe internally. A no-op stub is enough for the
// props/emits contract tests in this folder.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

/**
 * Mount a component with a fresh Vuetify instance.
 * Used by the Phase 5 component contract tests.
 */
export function mountWithVuetify<C extends Component>(
  component: C,
  options: ComponentMountingOptions<C> = {},
) {
  const vuetify = createVuetify({ components, directives })
  return mount(component, {
    ...options,
    global: { plugins: [vuetify], ...options.global },
  })
}
