<script setup lang="ts">
/**
 * InfoTopNav — horizontal navigation between the editorial pages.
 *
 * Visibility follows the same rule as the footer:
 *   - hidden on mobile (< 600px): the drawer + footer links are enough
 *   - visible on tablet and desktop (>= 600px, Vuetify "sm" breakpoint)
 *
 * Accessibility:
 *   - semantic <nav> + <ul> with an explicit aria-label
 *   - aria-current="page" on the active link
 *   - visible focus ring, respects prefers-reduced-motion
 *
 * The glass design tokens (--glass, --glass-border, --text-dim) are
 * inherited from the parent .info-page (see InfoPageShell.vue), with
 * safe fallbacks if the component is used elsewhere.
 */
const route = useRoute()

const links = [
  { to: '/', label: 'Accueil', icon: 'mdi-home-outline' },
  { to: '/a-propos', label: 'À propos' },
  { to: '/contact', label: 'Contact' },
  { to: '/confidentialite', label: 'Confidentialité' },
  { to: '/conditions-utilisation', label: 'Conditions' },
  { to: '/blog', label: 'Blog' },
]

function isCurrent(to: string) {
  return route.path === to
}
</script>

<template>
  <nav class="info-nav d-none position-sticky d-sm-flex pe-4 justify-end justify-md-center" aria-label="Navigation des pages d’information">
    <ul class="info-nav__list pa-1 ma-0 d-flex rounded-pill">
      <li v-for="link in links" :key="link.to">
        <NuxtLink
          :to="link.to"
          class="info-nav__link px-2 py-1 text-label-small"
          :class="{ 'info-nav__link--current': isCurrent(link.to) }"
          :aria-current="isCurrent(link.to) ? 'page' : undefined"
          :icon="link.icon ? link.icon : ''"
        >
          {{ link.label }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
/* Tablet and up (Vuetify "sm" breakpoint). */
@media (min-width: 600px) {
  .info-nav {
    top: 5px;
    right: 5px;
    z-index: 5;
    margin-inline: auto;
  }

  .info-nav__list {
    gap: 1px;
    list-style: none;
    border: 1px solid var(--glass-border, rgba(var(--v-theme-on-surface), 0.1));
    background: rgba(var(--v-theme-surface), 0.7);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  }

  .info-nav__link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 999px;
    color: var(--text-dim, rgba(var(--v-theme-on-background), 0.62));
    font-weight: 650;
    text-decoration: none;
    white-space: nowrap;
    transition: background-color 0.2s ease, color 0.2s ease;
  }

  .info-nav__link:hover {
    background: rgba(var(--v-theme-on-surface), 0.06);
    color: var(--text-main, rgb(var(--v-theme-on-background)));
  }

  .info-nav__link--current {
    background: rgba(var(--v-theme-primary), 0.14);
    color: rgb(var(--v-theme-primary));
  }

  .info-nav__link:focus-visible {
    outline: 3px solid rgb(var(--v-theme-primary));
    outline-offset: 2px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .info-nav__link {
    transition: none;
  }
}
</style>
