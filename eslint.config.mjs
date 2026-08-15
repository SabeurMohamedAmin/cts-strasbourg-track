// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

/**
 * ESLint flat config — Phase 0, Step 0.2 tooling.
 *
 * `withNuxt` extends the config that the @nuxt/eslint module generates in
 * .nuxt/ during `nuxt prepare` (runs automatically via the postinstall
 * script). Project-specific overrides go in the object below.
 */
export default withNuxt({
  rules: {
    // Pages and layouts legitimately use single-word names (index.vue).
    'vue/multi-word-component-names': 'off',
  },
})
