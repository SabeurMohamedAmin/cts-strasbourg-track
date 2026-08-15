<script setup lang="ts">
// Nuxt 4: FavoriteLineRow is auto-imported; only the type needs importing.
import type { LineDepartures } from '~/components/favorites/FavoriteLineRow.vue'

/** A line badge shown in the "served lines" row (every line at this stop). */
export interface ServedLine {
  /** Line label, e.g. "A" or "C8". */
  label: string
  /** Badge background colour (hex with '#'). */
  color: string
  mode: 'tram' | 'bus'
}

/**
 * "Glass" card for one favourite stop.
 *
 * Emits:
 * - `open`   → the stop name was clicked (open the stop details)
 * - `remove` → the "Retirer" button was clicked
 */
const props = defineProps<{
  /** Stop name shown as the card title, e.g. "Etoile Bourse". */
  stopName: string
  /** Transport modes serving this stop; drives the avatar icon and subtitle. */
  modes: Array<'tram' | 'bus'>
  /** Every line serving this stop, shown as a badge row. */
  servedLines: ServedLine[]
  /** Upcoming departures grouped by line, then by direction. */
  lines: LineDepartures[]
  /** True while arrivals are being (re)fetched → skeleton state. */
  loading?: boolean
  /** True when the real-time feed failed for this stop. */
  unavailable?: boolean
}>()

const emit = defineEmits<{ open: []; remove: [] }>()

const isTram = computed(() => props.modes.includes('tram'))

/** "Tram · Bus" subtitle under the stop name. */
const modeLabel = computed(() =>
  props.modes.map(mode => (mode === 'tram' ? 'Tram' : 'Bus')).join(' · ') || 'Arrêt CTS')

/** At least one departure comes from the live GTFS-RT feed. */
const hasRealtime = computed(() => props.lines.some(line => line.realtime))
</script>

<template>
  <v-card
    tag="section"
    role="group"
    :aria-label="`Arrêt ${stopName}`"
    class="glass-card"
    elevation="0"
    rounded="xl"
  >
    <!-- ── Header: avatar + title block (+ badges) + remove action ────── -->
    <v-card-item class="pa-4">
      <template #prepend>
        <v-avatar color="light-blue-lighten-4" size="40" aria-hidden="true">
          <v-icon :icon="isTram ? 'mdi-tram' : 'mdi-bus'" color="light-blue-darken-4" size="22" />
        </v-avatar>
      </template>

      <v-card-title tag="h3" class="pa-0 text-body-2 text-wrap">
        <v-btn
          type="button"
          variant="plain"
          density="compact"
          :ripple="false"
          class="glass-card__title pa-0 ma-0"
          :aria-label="`Voir les détails de l'arrêt ${stopName}`"
          @click="emit('open')"
        >
          {{ stopName }}
        </v-btn>
      </v-card-title>

      <v-card-subtitle class="pa-0 text-body-2 text-medium-emphasis">
        {{ modeLabel }}
      </v-card-subtitle>

      <!-- Every line serving this stop, grouped with the title. -->
      <ul
        v-if="servedLines.length"
        class="glass-card__served d-flex flex-wrap ga-2 pa-0 ma-0 mt-3"
        :aria-label="`Lignes desservant l'arrêt ${stopName}`"
      >
        <li v-for="line in servedLines" :key="`${line.mode}-${line.label}`">
          <v-chip
            label
            size="small"
            density="comfortable"
            class="line-badge font-weight-bold"
            :style="{ background: line.color, color: contrastTextColor(line.color) }"
          >
            <span class="d-sr-only">Ligne </span>{{ line.label }}
          </v-chip>
        </li>
      </ul>

      <template #append>
        <v-btn
          variant="tonal"
          rounded="pill"
          size="small"
          color="error"
          class="glass-card__action align-self-start"
          prepend-icon="mdi-delete-outline"
          :aria-label="`Retirer l'arrêt ${stopName} des favoris`"
          @click="emit('remove')"
        >
          Retirer
        </v-btn>
      </template>
    </v-card-item>

    <v-divider class="glass-card__divider mx-4" />

    <!-- ── Upcoming departures, grouped by line ───────────────────────── -->
    <v-card-text class="pa-4 pt-3">
      <div class="d-flex align-center justify-space-between mb-2">
        <span class="glass-card__section-label text-caption text-medium-emphasis text-uppercase">
          Prochains départs
        </span>
        <span
          v-if="hasRealtime"
          class="d-inline-flex align-center ga-2 text-caption text-medium-emphasis"
        >
          <i class="glass-card__live-dot" aria-hidden="true" />
          Temps réel
        </span>
      </div>

      <!-- Loading skeleton while (re)fetching -->
      <div v-if="loading" role="status">
        <v-skeleton-loader type="list-item-two-line" color="transparent" />
        <span class="d-sr-only">Actualisation des départs…</span>
      </div>

      <!-- Feed failed for this stop -->
      <p v-else-if="unavailable" class="glass-card__state text-body-2 text-medium-emphasis ma-0">
        Données indisponibles — affichage des horaires théoriques.
      </p>

      <!-- Nothing coming up -->
      <p v-else-if="!lines.length" class="glass-card__state text-body-2 text-medium-emphasis ma-0">
        Aucun départ dans les 90 prochaines minutes.
      </p>

      <!--
        aria-live="polite": refreshed countdowns are announced to screen
        readers without stealing focus or interrupting the user.
      -->
      <ul v-else class="glass-card__lines pa-0 ma-0" aria-live="polite">
        <FavoritesFavoriteLineRow
          v-for="line in lines"
          :key="`${line.mode}-${line.label}`"
          :line="line"
        />
      </ul>
    </v-card-text>
  </v-card>
</template>

<style scoped>
/*
 * ── Glassmorphism surface (not achievable with Vuetify utilities) ────
 * Theme tokens (surface / on-surface) flip automatically between light
 * and dark mode, keeping WCAG contrast in both.
 */
.glass-card {
  background: rgba(var(--v-theme-surface), .72) !important;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(var(--v-theme-on-surface), .12);
  color: rgb(var(--v-theme-on-surface));
}

/* Stop name doubles as the "open details" action. */
.glass-card__title {
  color: inherit;
  /* Fluid title: 16px on phones, up to 18px on large screens. */
  font-size: clamp(1rem, .95rem + .3vw, 1.125rem);
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: normal;
  cursor: pointer;
}
.glass-card__title:hover { text-decoration: underline; }

/* WCAG 2.5.5: keep a 44px hit area even though the pill looks small. */
.glass-card__action { min-width: 44px; min-height: 44px; flex-shrink: 0; }

.glass-card__divider { border-color: rgba(var(--v-theme-on-surface), .12); opacity: 1; }

.glass-card__served,
.glass-card__lines { list-style: none; }

/* Same footprint as the badges in FavoriteLineRow. */
.line-badge {
  min-width: 32px;
  height: 26px;
  justify-content: center;
  font-size: .75rem; /* ≥ 12px so line labels stay readable */
  letter-spacing: .02em;
}

.glass-card__section-label {
  font-weight: 750;
  letter-spacing: .1em;
}

.glass-card__state {
  display: flex;
  min-height: 48px;
  align-items: center;
  line-height: 1.6;
}

/* Pulsing green dot signalling live data. */
.glass-card__live-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: rgb(var(--v-theme-success, 46, 158, 79));
  animation: live-pulse 2s ease-in-out infinite;
}

@keyframes live-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(46, 158, 79, .5); }
  50% { box-shadow: 0 0 0 5px rgba(46, 158, 79, 0); }
}

/* Visible focus ring, tuned for the dark glass background. */
.glass-card :is(a, button):focus-visible {
  outline: 3px solid rgb(var(--v-theme-primary));
  outline-offset: 3px;
  border-radius: 4px;
}

@media (prefers-reduced-motion: reduce) {
  .glass-card__live-dot { animation: none; }
}

@media (forced-colors: active) {
  .glass-card { border: 1px solid CanvasText; }
  .line-badge { forced-color-adjust: none; }
}
</style>
