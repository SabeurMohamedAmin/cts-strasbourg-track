<!--
  AppMenuFab (Step 4.3)

  Floating hamburger button overlaid on the map (top-left, fixed).
  There is NO v-app-bar — the map occupies the full 100dvh viewport,
  so this FAB is the only entry point to the navigation drawer.

  Dumb component contract:
    props: open — whether the drawer is currently open (switches the icon)
    emits: toggle — the user clicked the button
-->
<script setup lang="ts">
defineProps<{
  open: boolean
}>()

defineEmits<{
  toggle: []
}>()
</script>

<template>
  <v-btn
    :icon="open ? 'mdi-close' : 'mdi-menu'"
    class="hamburger-fab"
    size="x-small"
    aria-label="Menu"
    @click="$emit('toggle')"
  />
</template>

<style scoped>

.hamburger-fab {
  position: fixed;
  top: 5px;
  left: 16px;
  z-index: 400;
  border-radius: 10px !important;
  /* Glassy primary: translucent brand colour + frosted blur */
  background: rgba(var(--v-theme-surface), 0.7) !important;
  color: rgba(var(--v-theme-on-surface), 0.5) !important;
  backdrop-filter: blur(12px) saturate(1.5);
  -webkit-backdrop-filter: blur(12px) saturate(1.5);
  border: 1px solid rgba(255, 255, 255, 0.3);
}
.hamburger-fab:hover, .hamburger-fab:focus-visible {
  background: rgba(var(--v-theme-surface), 0.8) !important;
  color: rgba(var(--v-theme-on-surface), 0.8) !important;
}
</style>
