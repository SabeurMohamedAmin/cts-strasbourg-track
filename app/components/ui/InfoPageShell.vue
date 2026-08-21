<script setup lang="ts">
/**
 * InfoPageShell — shared chrome for editorial pages (À propos, Contact,
 * Confidentialité, Conditions d’utilisation, Mentions légales).
 *
 * These pages exist mainly for SEO / Google AdSense compliance: they need
 * real, readable content with consistent typography. The shell provides:
 *   - the same top bar (back button + title) as the station page
 *   - a glass header card with icon, title and subtitle
 *   - a typographic content area (h2/h3/p/ul styled via :deep, so pages
 *     write plain semantic HTML without repeating CSS)
 *   - a footer cross-linking every editorial page (good for crawlers)
 *
 * Reuses the design tokens of the home / station pages so the app feels
 * consistent everywhere.
 */
import InfoTopNav from '~/components/ui/InfoTopNav.vue'

withDefaults(defineProps<{
  /** Page H1, e.g. "Politique de confidentialité". */
  title: string
  /** Optional one-line subtitle under the title. */
  subtitle?: string
  /** MDI icon of the header card. */
  icon?: string
}>(), {
  subtitle: '',
  icon: 'mdi-information-outline',
})

const route = useRoute()

/** Every editorial page, for the footer navigation. */
const INFO_LINKS = [
  { to: '/a-propos', label: 'À propos' },
  { to: '/contact', label: 'Contact' },
  { to: '/confidentialite', label: 'Confidentialité' },
  { to: '/conditions-utilisation', label: 'Conditions d’utilisation' },
  { to: '/mentions-legales', label: 'Mentions légales' },
  { to: '/blog', label: 'Blog' },
]
</script>

<template>
  <div class="info-page">
    <!-- ── Top navigation (tablet & desktop only) ── -->
    <InfoTopNav />

    <!-- ── Page header card ── -->
    <section class="section">
      <div class="info-card">
        <span class="info-card__icon" aria-hidden="true">
          <v-icon :icon="icon" size="26" />
        </span>
        <div class="info-card__copy">
          <h1 class="text-headline-small text-sm-headline-medium font-weight-bold">{{ title }}</h1>
          <p v-if="subtitle" class="text-body-small text-sm-body-medium text-medium-emphasis">{{ subtitle }}</p>
        </div>
      </div>
    </section>

    <!-- ── Editorial content (styled through :deep below) ── -->
    <section class="section info-content">
      <slot />
    </section>

    <!-- ── Cross-links between editorial pages ── -->
    <footer class="section info-footer">
      <nav class="info-footer__links" aria-label="Pages d’information">
        <NuxtLink
          v-for="link in INFO_LINKS"
          :key="link.to"
          :to="link.to"
          class="info-footer__link text-label-medium"
          :class="{ 'info-footer__link--current': route.path === link.to }"
        >{{ link.label }}</NuxtLink>
      </nav>
      <NuxtLink to="/" class="info-footer__home text-label-large font-weight-bold">
        <v-icon icon="mdi-home-outline" size="16" aria-hidden="true" />
        Retour à l’accueil
      </NuxtLink>

      <!-- Data attribution — required by the GTFS / OpenStreetMap licenses. -->
      <p class="info-footer__attribution text-label-small">
        Données horaires : GTFS CTS via
        <a href="https://transport.data.gouv.fr" target="_blank" rel="noopener noreferrer">transport.data.gouv.fr</a>
        · Fond de carte :
        <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a>
        © contributeurs
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
      </p>
    </footer>
  </div>
</template>

<style scoped>
/* Same design tokens as the home / station pages. */
.info-page {
  --text-main: rgba(var(--v-theme-on-background), .92);
  --text-dim: rgba(var(--v-theme-on-background), .62);
  --glass: rgba(var(--v-theme-surface), .78);
  --glass-border: rgba(var(--v-theme-on-surface), .1);
  position: relative;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  color: var(--text-main);
  padding-bottom: 100px;
  background:
    radial-gradient(circle at 50% -10%, rgba(var(--v-theme-primary), .055), transparent 30rem),
    rgb(var(--v-theme-background));
}
:global(.v-theme--dark) .info-page {
  --glass: rgba(var(--v-theme-surface), .66);
  --glass-border: rgba(var(--v-theme-on-surface), .075);
}

.section {
  width: min(100%, 760px);
  margin-inline: auto;
  padding: 18px 16px 0;
}

/* ── Header card ── */
.info-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 16px;
  border: 1px solid var(--glass-border);
  border-radius: 18px;
  background: var(--glass);
  box-shadow: 0 8px 24px rgba(0, 0, 0, .08);
}
.info-card__icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  flex: 0 0 auto;
  border-radius: 14px;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), .09);
}
.info-card__copy { min-width: 0; }

/* ── Editorial typography, applied to slotted content ── */
.info-content :deep(h2) {
  margin: 26px 0 8px;
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1.3;
}
.info-content :deep(h2:first-child) { margin-top: 4px; }
.info-content :deep(h3) {
  margin: 18px 0 6px;
  font-size: .92rem;
  font-weight: 750;
}
.info-content :deep(p) {
  margin-bottom: 10px;
  color: var(--text-dim);
  font-size: .875rem;
  line-height: 1.65;
}
.info-content :deep(ul) {
  margin: 0 0 12px;
  padding-left: 22px;
  color: var(--text-dim);
  font-size: .875rem;
  line-height: 1.65;
}
.info-content :deep(li) { margin-bottom: 4px; }
.info-content :deep(strong) { color: var(--text-main); font-weight: 700; }
.info-content :deep(a) {
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
  text-decoration: none;
}
.info-content :deep(a:hover) { text-decoration: underline; }
.info-content :deep(.info-note) {
  margin: 14px 0;
  padding: 12px 14px;
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  background: var(--glass);
}

/* ── Footer ── */
.info-footer {
  margin-top: 34px;
  padding-top: 20px;
  border-top: 1px solid var(--glass-border);
}
.info-footer__links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  justify-content: center;
}
.info-footer__link {
  color: var(--text-dim);
  text-decoration: none;
}
.info-footer__link:hover { color: var(--text-main); }
.info-footer__link--current {
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
}
.info-footer__home {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 18px;
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
}
.info-footer__link:focus-visible,
.info-footer__home:focus-visible {
  outline: 3px solid rgb(var(--v-theme-primary));
  outline-offset: 3px;
}
.info-footer__attribution {
  margin-top: 16px;
  color: var(--text-dim);
  text-align: center;
}
.info-footer__attribution a {
  color: var(--text-dim);
  text-decoration: underline;
}
.info-footer__attribution a:hover { color: var(--text-main); }
</style>
