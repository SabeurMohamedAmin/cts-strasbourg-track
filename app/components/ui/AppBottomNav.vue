<script setup lang="ts">
/** One entry per tab in the bottom navigation. */
interface NavTab {
  /** Visible label under the icon. */
  label: string
  /** MDI icon name. */
  icon: string
  /** Route the tab navigates to. */
  to: string
  /**
   * Exact route matching. Required for "/" (the home tab), otherwise
   * it would be considered "active" on every route that starts with /.
   */
  exact?: boolean
  /** Shows the pulsing red "streaming" dot on the icon. */
  liveDot?: boolean
}

// To add/remove/reorder a tab, edit this array only.
// Horaires is the HOME page: it lives on "/" (no redirect) so the
// app's first paint is as fast as possible.
const TABS: NavTab[] = [
  { label: 'Horaires', icon: 'mdi-clock-outline', to: '/', exact: true },
  { label: 'Favoris', icon: 'mdi-star-outline', to: '/favoris' },
  { label: 'Plans', icon: 'mdi-map-outline', to: '/plans' },
  { label: 'Live', icon: 'mdi-access-point', to: '/live', liveDot: true },
]
</script>

<template>
  <!--
    Bottom tab bar shared by every page (declared once in layouts/default.vue).
    Frosted-glass design: active tab gets an electric-blue pill behind its
    icon plus a small dot indicator; the Live tab carries a pulsing red dot
    signalling that real-time data is streaming.
  -->
  <v-bottom-navigation
    grow
    height="72"
    :elevation="0"
    class="app-bottom-nav"
    aria-label="Navigation principale"
  >
    <v-btn
      v-for="tab in TABS"
      :key="tab.to"
      :to="tab.to"
      :value="tab.to"
      :exact="tab.exact"
      class="nav-btn"
    >
      <span class="icon-wrap">
        <v-icon :icon="tab.icon" size="24" />
        <span v-if="tab.liveDot" class="live-dot" aria-hidden="true" />
      </span>
      <span class="nav-label">{{ tab.label }}</span>
      <span class="active-indicator" aria-hidden="true" />
    </v-btn>
  </v-bottom-navigation>
</template>

<style scoped>
/* Frosted glass bar over the deep-dark app background. */
.app-bottom-nav {
  background: rgba(13, 18, 34, 0.72) !important;
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  /* Keep the bar clear of iOS/Android gesture areas. */
  padding-bottom: env(safe-area-inset-bottom);
}

.nav-btn {
  color: #8a9bb0 !important;
}
.nav-btn.v-btn--active {
  color: #4fc3f7 !important;
}
/* Vuetify dims active bottom-nav buttons via opacity — keep ours crisp. */
.nav-btn.v-btn--active :deep(.v-btn__overlay) {
  opacity: 0;
}

.icon-wrap {
  position: relative;
  display: inline-flex;
  padding: 4px 14px;
  border-radius: 100px;
  transition: background 0.2s ease;
}
.v-btn--active .icon-wrap {
  background: rgba(79, 195, 247, 0.15);
}

.nav-label {
  font-size: 0.75rem;
  margin-top: 2px;
}

/* Small dot under the active tab's label. */
.active-indicator {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  margin-top: 3px;
  background: transparent;
}
.v-btn--active .active-indicator {
  background: #4fc3f7;
}

/* Pulsing red dot on the Live tab — real-time data is streaming. */
.live-dot {
  position: absolute;
  top: 2px;
  right: 8px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ff5252;
  animation: live-pulse 1.8s ease-out infinite;
}
@keyframes live-pulse {
  0% { box-shadow: 0 0 0 0 rgba(255, 82, 82, 0.55); }
  70% { box-shadow: 0 0 0 6px rgba(255, 82, 82, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255, 82, 82, 0); }
}

/* Accessibility: no decorative animation for users who opt out. */
@media (prefers-reduced-motion: reduce) {
  .live-dot {
    animation: none;
  }
}
</style>
