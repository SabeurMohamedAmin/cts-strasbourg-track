import { mount, type ComponentMountingOptions } from '@vue/test-utils'
import { ref, type Component } from 'vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { vi } from 'vitest'

// happy-dom does not implement ResizeObserver, which some Vuetify
// components observe internally. A no-op stub is enough for the
// props/emits contract tests in this folder.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

// Nuxt auto-imports (useState, …) are not available in a plain happy-dom
// test. Stub useState with a plain Vue ref so composables like useNow run
// unchanged: useState(key, init) → ref(init()).
vi.stubGlobal('useState', (_key: string, init: () => unknown) => ref(init()))

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
