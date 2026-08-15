import { h } from 'vue'
import { createVuetify, type IconProps, type IconSet } from 'vuetify'
import 'vuetify/styles'
import { aliases } from 'vuetify/iconsets/mdi'
import { mdi as mdiSvg } from 'vuetify/iconsets/mdi-svg'
import { mdiIconPaths } from '~/utils/mdi-icons'

/**
 * Vuetify is configured here (theme + icons).
 *
 * Icons: the app no longer ships the full MDI icon FONT (~395 KiB woff2,
 * render-blocking, ~7000 glyphs). Instead, only the SVG paths listed in
 * app/utils/mdi-icons.ts are bundled. Templates keep using the familiar
 * `icon="mdi-heart"` strings: the custom icon set below translates each
 * name into its SVG path at render time.
 *
 * Components and directives are NOT registered globally: vite-plugin-vuetify
 * (see nuxt.config.ts) scans templates and bundles only the `v-*` components
 * each page actually uses, keeping the JS payload small.
 */
const appIcons: IconSet = {
  component: (props: IconProps) => {
    const path = mdiIconPaths[String(props.icon)]

    // Unknown name → nothing is rendered. Warn in dev so the missing icon
    // gets added to app/utils/mdi-icons.ts right away.
    if (!path && import.meta.dev) {
      console.warn(`[icons] "${String(props.icon)}" is missing from app/utils/mdi-icons.ts`)
    }

    // Reuse Vuetify's own SVG icon component (the mdi-svg set) to draw the path.
    return h(mdiSvg.component, { ...props, icon: path ?? '' })
  },
}

export default defineNuxtPlugin((app) => {
  const vuetify = createVuetify({
    icons: {
      defaultSet: 'mdi',
      // Vuetify's internal aliases ($close, $expand, $dropdown…) resolve to
      // 'mdi-*' names, which our custom set handles like any template icon.
      aliases,
      sets: { mdi: appIcons },
    },
    theme: {
      defaultTheme: 'light',
      themes: {
        light: {
          colors: {
            primary: '#c8102e',
            secondary: '#1a1a2e',
            surface: '#ffffff',
          },
        },
        dark: {
          colors: {
            primary: '#ff4d6d',
            secondary: '#e0e0e0',
            surface: '#1e1e2e',
          },
        },
      },
    },
  })
  app.vueApp.use(vuetify)
})
