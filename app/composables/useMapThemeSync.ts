/**
 * useMapThemeSync (Step 2.5)
 *
 * Keeps the base map style in sync with the Vuetify theme:
 *   - isDark() / styleForTheme() — which style URL matches the active theme
 *   - the theme watcher that swaps the base style
 *   - safeOnceStyleLoad — replaces (never stacks) the pending one-shot
 *     'style.load' handler when the user toggles the theme rapidly
 *   - the debounced custom-layer rebuild after a style swap
 *
 * The composable owns WHEN layers must be rebuilt; the owning component
 * passes `reloadLayers` describing HOW (detach everything, re-attach in
 * the right order). This keeps the component dumb and the sequencing here.
 */
import type maplibregl from 'maplibre-gl'
import type { ShallowRef } from 'vue'
import { useTheme } from 'vuetify'
import { STYLE_RELOAD_DEBOUNCE_MS } from '~/utils/map-constants'

export interface MapThemeSyncOptions {
  /** Rebuild all custom layers once the new base style has loaded. */
  reloadLayers: () => Promise<void> | void
}

export function useMapThemeSync(
  map: ShallowRef<maplibregl.Map | undefined>,
  options: MapThemeSyncOptions,
) {
  const config = useRuntimeConfig()
  const vuetifyTheme = useTheme()

  let styleReloadTimer: ReturnType<typeof setTimeout> | null = null
  let pendingStyleHandler: (() => void) | null = null

  /**
   * Read the theme actually applied to THIS component tree.
   *
   * index.vue drives the theme through `<v-app :theme="...">`, which changes
   * the LOCAL (injected) theme only — `vuetifyTheme.global` keeps the plugin
   * default ('light') forever. Reading the global theme here is why the map
   * previously never switched to the dark style.
   */
  function isDark() { return vuetifyTheme.current.value.dark }

  function styleForTheme(dark: boolean) {
    return dark ? (config.public.mapStyleDarkUrl as string) : (config.public.mapStyleUrl as string)
  }

  /** Debounced rebuild: rapid theme toggles trigger a single reload. */
  function reloadLayersAfterStyleChange() {
    if (styleReloadTimer !== null) clearTimeout(styleReloadTimer)
    styleReloadTimer = setTimeout(async () => {
      styleReloadTimer = null
      if (!map.value) return
      await options.reloadLayers()
    }, STYLE_RELOAD_DEBOUNCE_MS)
  }

  /** Register a one-shot 'style.load' handler, dropping any pending one. */
  function safeOnceStyleLoad(handler: () => void) {
    const m = map.value
    if (!m) return
    if (pendingStyleHandler) m.off('style.load', pendingStyleHandler)
    pendingStyleHandler = handler
    m.once('style.load', () => { pendingStyleHandler = null; handler() })
  }

  // Theme changed (drawer toggle): swap the base map style, then rebuild
  // all custom layers once the new style has loaded.
  watch(() => vuetifyTheme.current.value.dark, (dark) => {
    if (!map.value) return
    safeOnceStyleLoad(reloadLayersAfterStyleChange)
    map.value.setStyle(styleForTheme(dark))
  })

  onUnmounted(() => {
    if (styleReloadTimer !== null) clearTimeout(styleReloadTimer)
  })

  return { isDark, styleForTheme }
}
