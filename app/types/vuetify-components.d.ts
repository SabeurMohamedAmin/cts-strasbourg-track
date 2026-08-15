/**
 * Vuetify components are auto-imported at build time by vite-plugin-vuetify
 * (see nuxt.config.ts), so they are never registered globally in our code.
 * Without this file, the Vue language server (Volar) does not know they
 * exist, which means NO autocomplete in templates.
 *
 * Declaring them on GlobalComponents gives us:
 *  - tag autocomplete:   <v-btn>, <v-card>, <v-dialog>, ...
 *  - prop autocomplete:  color, variant, density, ...
 *  - type checking of props inside <template>
 *
 * This file is types-only: it adds nothing to the final bundle.
 */

// Map of every component exported by Vuetify, e.g. { VBtn: ..., VCard: ... }
type VuetifyComponents = typeof import('vuetify/components')

declare module 'vue' {
  // Tell Vue (and Volar) these components are available everywhere.
  interface GlobalComponents extends VuetifyComponents {}
}

export {}
