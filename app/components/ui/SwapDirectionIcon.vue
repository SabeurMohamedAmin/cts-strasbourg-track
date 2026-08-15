<script setup lang="ts">
/**
 * SwapDirectionIcon — the two arrows of MDI "swap-horizontal", colored
 * independently so ONE of them can be highlighted to show a travel direction:
 *
 *   direction="right" → the → arrow uses `activeColor`, the ← arrow fades
 *   direction="left"  → the ← arrow uses `activeColor`, the → arrow fades
 *
 * Reusable anywhere a direction needs visualising (direction toggles,
 * stop sheets, favourites…). Colors default to Vuetify theme variables for
 * seamless light/dark support, but accept any CSS color — pass
 * `currentColor` to inherit from the surrounding text.
 */
withDefaults(defineProps<{
  /** Which arrow is highlighted. */
  direction: 'left' | 'right'
  /** Fill of the highlighted arrow. Any CSS color. */
  activeColor?: string
  /** Fill of the faded arrow. Any CSS color. */
  inactiveColor?: string
  /** Rendered square size in px. */
  size?: number | string
  width?: number | string
  height?: number | string
}>(), {
  activeColor: 'rgb(var(--v-theme-primary))',
  inactiveColor: 'rgba(var(--v-theme-on-surface), 0.38)',
  size: 24,
  width: 24,
  height: 24
})

// Paths extracted from Material Design Icons "mdi-swap-horizontal".
const LEFT_ARROW_PATH = 'M7,11 L3,15 L7,19 V16 H14 V14 H7 V11 Z'
const RIGHT_ARROW_PATH = 'M21,9 L17,5 V8 H10 V10 H17 V13 Z'
</script>

<template>
  
  <svg
    :style="{width:width ?width :size , height:height ?height :size}"
    class="swap-icon"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      class="swap-icon__path"
      :d="LEFT_ARROW_PATH"
      :fill="direction === 'left' ? activeColor : inactiveColor"
    />
    <path
      class="swap-icon__path"
      :d="RIGHT_ARROW_PATH"
      :fill="direction === 'right' ? activeColor : inactiveColor"
    />
  </svg>
</template>

<style scoped>
.swap-icon {
  display: inline-block;
  flex: 0 0 auto;
  vertical-align: middle;
}
.swap-icon__path {
  /* Smooth color swap when the selected direction changes. */
  transition: fill .2s ease;
}
@media (prefers-reduced-motion: reduce) {
  .swap-icon__path { transition: none; }
}
</style>
