import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'

/**
 * Vitest configuration.
 *
 * - Runs files in tests/unit/** only (not E2E or integration).
 * - The Vue plugin compiles .vue SFCs for component tests (Phase 5).
 *   Component tests opt into a DOM with `// @vitest-environment happy-dom`
 *   at the top of the file; pure logic tests keep the faster default
 *   node environment.
 * - ~~ alias resolves to the repo root so shared/ imports work without
 *   the Nuxt layer.
 */
export default defineConfig({
  plugins: [vue()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    globals: true,
    server: {
      deps: {
        // Vuetify ships ESM that imports .css files. Node cannot load CSS,
        // so vuetify must be inlined for Vite to transform those imports
        // (used by the component tests via vuetify/components).
        inline: ['vuetify'],
      },
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      // text     — console summary (parsed by the GitLab coverage regex)
      // html     — browsable report, published as a pipeline artifact
      // cobertura — consumed by GitLab for MR diff coverage annotations
      reporter: ['text', 'html', 'cobertura'],
      include: [
        'app/utils/**',
        'app/composables/**',
        'app/components/**',
        'server/**',
        'shared/**',
      ],
    },
  },
  resolve: {
    alias: {
      // Mirrors the ~~ alias Nuxt sets for the workspace root.
      '~~': resolve(__dirname, '.'),
      // Mirrors the ~ alias Nuxt sets for the app/ directory.
      '~': resolve(__dirname, 'app'),
    },
  },
})
