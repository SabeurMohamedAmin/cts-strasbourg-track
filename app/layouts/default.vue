<script setup lang="ts">
// This layout is CHROME + WIRING only. Behavior lives in:
//   useAppTheme         — SSR-safe cookie theme
//   AppMenuFab          — floating hamburger button
import AppMenuFab from '~/components/ui/AppMenuFab.vue'
import AppDrawer from '~/components/ui/AppDrawer.vue'
import AppBackToTop from '~/components/ui/AppBackToTop.vue'
import PwaStatus from '~/components/ui/PwaStatus.vue'
import { useVehicleStream } from '~/composables/useVehicleStream'
import { useAppTheme } from '~/composables/useAppTheme'

// Live vehicle SSE stream feeds the vehicles store for the whole app.
// It lives in the layout (not in a page) so every tab — Live, Favoris,
// Horaires — keeps receiving fresh data while the user navigates.
useVehicleStream()

const route = useRoute()
const drawerOpen = ref(false)
const homeHeaderOutOfView = ref(false)

provide('toggleAppDrawer', () => { drawerOpen.value = !drawerOpen.value })
provide('setHomeHeaderOutOfView', (isOutOfView: boolean) => {
  homeHeaderOutOfView.value = isOutOfView
})

watch(() => route.path, () => {
  homeHeaderOutOfView.value = false
})

const { theme, isDark, toggleTheme } = useAppTheme()
</script>

<template>
  <v-app :theme="theme">
    <!-- Floating hamburger button (over the content) — see AppMenuFab.vue -->
    <app-menu-fab
      v-if="route.path !== '/' || homeHeaderOutOfView"
      :open="drawerOpen"
      @toggle="drawerOpen = !drawerOpen"
    />

    <!--
      AppDrawer is wrapped in <ClientOnly> to prevent Vuetify SSR hydration
      class mismatches.
    -->
    <client-only>
      <app-drawer
        v-model="drawerOpen"
        :is-dark="isDark"
        @toggle-theme="toggleTheme"
      />
      
      <!-- Floating back-to-top button (on scroll) -->
      <app-back-to-top />
    </client-only>

    <!-- Page content. -->
    <v-main class="app-main">
      <slot />
    </v-main>



    <!-- PWA install prompt -->
    <pwa-status/>
  </v-app>
</template>

<style scoped>
/*
 * Make <v-main> a full-height flex column so pages (especially the
 * full-screen map on /live) can stretch to fill the available space.
 * We intentionally do NOT reset Vuetify's padding here: the layout
 * system uses it to offset the bottom navigation bar.
 */
.app-main {
  display: flex !important;
  flex-direction: column !important;
  flex: 1 1 0 !important;
  height: 100% !important;
  overflow: hidden !important;
}
</style>
