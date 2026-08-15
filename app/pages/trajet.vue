<!--
  PLAN — network plan page (same design language as the home page).
  Sections top to bottom: hero heading → quick actions → mode filter →
  line directory (real GTFS lines with their official colours).
  Data comes from useLinesStore (GET /api/routes).
-->
<script setup lang="ts">
  import { useLinesStore } from '~/stores/lines'

  const linesStore = useLinesStore()

  const linesLoading = ref(false)
  const linesFailed = ref(false)

  onMounted(loadLines)

  async function loadLines() {
    linesFailed.value = false
    linesLoading.value = true
    try {
      await linesStore.fetchLines()
    }
    catch {
      linesFailed.value = true
    }
    finally {
      linesLoading.value = false
    }
  }

  // ── Mode filter (same single-choice pattern as the home page) ──
  const MODES = [
    { id: 'all', label: 'Tous', icon: 'mdi-transit-connection-variant', accent: '148, 163, 184' },
    { id: 'tram', label: 'Tram', icon: 'mdi-tram', accent: '79, 195, 247' },
    { id: 'bus', label: 'Bus', icon: 'mdi-bus', accent: '102, 187, 106' },
  ] as const
  type ModeId = (typeof MODES)[number]['id']

  const activeMode = ref<ModeId>('all')

  // ── View models ──
  const tramLines = computed(() =>
    linesStore.lines.filter(line => line.routeType === 0),
  )

  const busLines = computed(() =>
    linesStore.lines
      .filter(line => line.routeType === 3)
      .slice()
      .sort((a, b) => {
        const numberA = Number.parseInt(a.routeShortName) || 0
        const numberB = Number.parseInt(b.routeShortName) || 0
        return numberA !== numberB ? numberA - numberB : a.routeShortName.localeCompare(b.routeShortName)
      }),
  )

  /** Sections displayed under the mode filter, in order. */
  const visibleSections = computed(() => [
    { id: 'tram', title: 'Lignes de tram', icon: 'mdi-tram', lines: tramLines.value },
    { id: 'bus', title: 'Lignes de bus', icon: 'mdi-bus', lines: busLines.value },
  ].filter(section => (activeMode.value === 'all' || activeMode.value === section.id) && section.lines.length))

  const totalVisibleLines = computed(() =>
    visibleSections.value.reduce((total, section) => total + section.lines.length, 0),
  )

  /** Open the interactive map — the line filter panel lives there. */
  function openMap() {
    navigateTo('/live')
  }
</script>

<template>
  <div class="plan-page">
    <!-- ── Hero heading ── -->
    <section class="section hero" aria-labelledby="plan-heading">
      <div>
        <h1 id="plan-heading" class="hero-title">Plan du réseau</h1>
        <p class="hero-description">Toutes les lignes de tram et de bus de l’Eurométropole de Strasbourg.</p>
      </div>
      <div class="hero-badge" :aria-label="`${totalVisibleLines} lignes affichées`">
        <v-icon icon="mdi-transit-connection-variant" size="18" aria-hidden="true" />
        <span aria-live="polite">{{ totalVisibleLines }}</span>
      </div>
    </section>

    <!-- ── Quick actions (same card pattern as the home page) ── -->
    <section class="section" aria-label="Actions rapides">
      <div class="quick-actions">
        <button
          type="button"
          class="quick-action quick-action--map"
          aria-label="Ouvrir la carte interactive du réseau"
          @click="openMap"
        >
          <span class="quick-action__icon" aria-hidden="true"><v-icon icon="mdi-map-outline" size="21" /></span>
          <span class="quick-action__copy">
            <strong>Carte interactive</strong>
            <small>Lignes & véhicules en direct</small>
          </span>
          <v-icon class="quick-action__arrow" icon="mdi-chevron-right" size="18" aria-hidden="true" />
        </button>

        <button
          type="button"
          class="quick-action quick-action--search"
          aria-label="Rechercher un arrêt ou une adresse"
          @click="navigateTo('/')"
        >
          <span class="quick-action__icon" aria-hidden="true"><v-icon icon="mdi-magnify" size="21" /></span>
          <span class="quick-action__copy">
            <strong>Trouver un arrêt</strong>
            <small>Arrêt, adresse ou ville</small>
          </span>
          <v-icon class="quick-action__arrow" icon="mdi-chevron-right" size="18" aria-hidden="true" />
        </button>
      </div>
    </section>

    <!-- ── Mode filter (identical pill pattern to the home page) ── -->
    <section class="section" aria-labelledby="plan-filter-heading">
      <h2 id="plan-filter-heading" class="sr-only">Filtrer les lignes</h2>
      <div class="mode-toggles" role="radiogroup" aria-label="Filtrer par type de transport">
        <button
          v-for="option in MODES"
          :key="option.id"
          type="button"
          class="mode-toggle"
          :class="{ 'mode-toggle--active': activeMode === option.id }"
          :style="{ '--mode-accent': option.accent }"
          role="radio"
          :aria-checked="activeMode === option.id"
          @click="activeMode = option.id"
        >
          <v-icon :icon="option.icon" size="16" aria-hidden="true" />
          {{ option.label }}
        </button>
      </div>
    </section>

    <!-- ── Line directory ── -->
    <section class="section directory" aria-labelledby="directory-heading" :aria-busy="linesLoading">
      <h2 id="directory-heading" class="sr-only">Lignes du réseau</h2>

      <div v-if="linesLoading" class="state-card" role="status" aria-live="polite">
        <v-progress-circular indeterminate size="22" width="2" aria-hidden="true" />
        Chargement des lignes du réseau…
      </div>

      <div v-else-if="linesFailed" class="state-card" role="alert">
        <v-icon icon="mdi-cloud-alert-outline" size="26" aria-hidden="true" />
        <span>Les lignes sont temporairement indisponibles.</span>
        <button type="button" class="btn-primary" @click="loadLines">Réessayer</button>
      </div>

      <template v-else>
        <section
          v-for="group in visibleSections"
          :key="group.id"
          class="line-group"
          :aria-labelledby="`lines-${group.id}`"
        >
          <header class="line-group__header">
            <v-icon :icon="group.icon" size="18" aria-hidden="true" />
            <h3 :id="`lines-${group.id}`">{{ group.title }}</h3>
            <span class="line-group__count">{{ group.lines.length }}</span>
          </header>

          <ul class="line-list">
            <li v-for="line in group.lines" :key="line.routeId">
              <button
                type="button"
                class="line-row"
                :aria-label="`Ligne ${line.routeShortName}${line.routeLongName ? `, ${line.routeLongName}` : ''}. Voir sur la carte`"
                @click="openMap"
              >
                <span
                  class="line-row__badge"
                  :style="{ background: `#${line.routeColor}`, color: `#${line.routeTextColor}` }"
                  aria-hidden="true"
                >
                  {{ line.routeShortName }}
                </span>
                <span class="line-row__name">{{ line.routeLongName ?? `Ligne ${line.routeShortName}` }}</span>
                <v-icon class="line-row__arrow" icon="mdi-chevron-right" size="18" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </section>

        <div v-if="!visibleSections.length" class="state-card" role="status">
          <v-icon icon="mdi-map-search-outline" size="26" aria-hidden="true" />
          Aucune ligne pour ce filtre.
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
/* Same design tokens as the home page (horaires-page). */
.plan-page {
  --accent: rgb(var(--v-theme-primary));
  --text-main: rgba(var(--v-theme-on-background), 0.92);
  --text-dim: rgba(var(--v-theme-on-background), 0.62);
  --glass: rgba(var(--v-theme-surface), 0.78);
  --glass-border: rgba(var(--v-theme-on-surface), 0.1);
  --accent-tint: 0.065;
  --accent-border: 0.3;
  overflow-y: auto;
  padding-bottom: 100px;
  color: var(--text-main);
  background:
    radial-gradient(circle at 50% -10%, rgba(var(--v-theme-primary), 0.055), transparent 30rem),
    rgb(var(--v-theme-background));
}

.section {
  width: min(100%, 960px);
  margin-inline: auto;
  padding: 18px 16px 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* ── Hero ── */
.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding-top: 26px;
}
.hero-title { font-size: 1.35rem; font-weight: 800; line-height: 1.25; }
.hero-description { margin-top: 4px; color: var(--text-dim); font-size: 0.8rem; line-height: 1.45; max-width: 420px; }
.hero-badge {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  padding: 8px 13px;
  border: 1px solid rgba(var(--v-theme-primary), 0.3);
  border-radius: 100px;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
  font-size: 0.85rem;
  font-weight: 800;
}

/* ── Quick actions (mirrors the home page cards) ── */
.quick-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.quick-action {
  --action-color: var(--v-theme-primary);
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  min-height: 60px;
  padding: 9px 10px;
  border: 1px solid var(--glass-border);
  border-radius: 15px;
  color: var(--text-main);
  background:
    linear-gradient(135deg, rgba(var(--action-color), var(--accent-tint)), transparent 58%),
    var(--glass);
  text-align: left;
  cursor: pointer;
  transition: border-color 160ms ease, background-color 160ms ease, transform 160ms ease;
}
.quick-action--map { --action-color: 79, 195, 247; }
.quick-action--search { --action-color: 102, 187, 106; }
.quick-action__icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 11px;
  color: rgb(var(--action-color));
  background: rgba(var(--action-color), 0.09);
}
.quick-action__copy { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.quick-action__copy strong { overflow: hidden; font-size: 0.78rem; font-weight: 750; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
.quick-action__copy small { overflow: hidden; color: var(--text-dim); font-size: 0.64rem; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
.quick-action__arrow { color: var(--text-dim); transition: transform 160ms ease; }
@media (hover: hover) {
  .quick-action:hover {
    border-color: rgba(var(--action-color), var(--accent-border));
    background-color: rgba(var(--action-color), 0.035);
    transform: translateY(-1px);
  }
  .quick-action:hover .quick-action__arrow { transform: translateX(2px); }
}
@media (max-width: 340px) {
  .quick-actions { grid-template-columns: 1fr; }
}

/* ── Mode toggles (identical to the home page) ── */
.mode-toggles {
  display: flex;
  width: 100%;
  gap: 3px;
  padding: 3px;
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  background: rgba(var(--v-theme-surface), 0.58);
}
.mode-toggle {
  --mode-accent: 79, 195, 247;
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 11px;
  border: 0;
  border-radius: 9px;
  color: var(--text-dim);
  background: transparent;
  font: inherit;
  font-size: 0.83rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, transform 0.12s ease;
}
.mode-toggle:active { transform: scale(0.97); }
.mode-toggle--active {
  color: var(--text-main);
  background: rgba(var(--v-theme-on-surface), 0.1);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}
.mode-toggle--active .v-icon { color: rgb(var(--mode-accent)); }

/* ── Loading / error / empty states ── */
.state-card {
  display: flex;
  min-height: 96px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 18px;
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  color: var(--text-dim);
  background: var(--glass);
  font-size: 0.8rem;
  text-align: center;
}
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 14px;
  border: 0;
  border-radius: 12px;
  color: rgb(var(--v-theme-on-primary));
  background: rgb(var(--v-theme-primary));
  font: inherit;
  font-size: 0.78rem;
  font-weight: 750;
  cursor: pointer;
}

/* ── Line directory ── */
.directory { display: flex; flex-direction: column; gap: 16px; }
.line-group {
  overflow: hidden;
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  background: var(--glass);
}
.line-group__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 13px 14px;
  color: rgb(var(--v-theme-primary));
  border-bottom: 1px solid var(--glass-border);
}
.line-group__header h3 { flex: 1; color: var(--text-main); font-size: 0.9rem; font-weight: 800; }
.line-group__count {
  padding: 2px 9px;
  border-radius: 100px;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
  font-size: 0.72rem;
  font-weight: 800;
}
.line-list { margin: 0; padding: 6px; list-style: none; }
.line-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  width: 100%;
  align-items: center;
  gap: 11px;
  padding: 9px 8px;
  border: 0;
  border-radius: 12px;
  color: var(--text-main);
  background: transparent;
  font: inherit;
  font-size: 0.83rem;
  text-align: left;
  cursor: pointer;
  transition: background-color 140ms ease;
}
.line-row:hover { background: rgba(var(--v-theme-on-surface), 0.06); }
.line-row__badge {
  display: grid;
  min-width: 44px;
  height: 30px;
  padding-inline: 7px;
  place-items: center;
  border-radius: 9px;
  font-size: 0.8rem;
  font-weight: 850;
}
.line-row__name {
  overflow: hidden;
  font-weight: 650;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.line-row__arrow { color: var(--text-dim); }

/* ── Accessibility ── */
.quick-action:focus-visible,
.mode-toggle:focus-visible,
.line-row:focus-visible,
.btn-primary:focus-visible {
  outline: 3px solid rgb(var(--v-theme-primary));
  outline-offset: 4px;
}
.line-row:focus-visible { outline-offset: -3px; }

@media (prefers-reduced-motion: reduce) {
  .quick-action,
  .quick-action__arrow,
  .mode-toggle,
  .line-row { transition: none; }
}

@media (forced-colors: active) {
  .quick-action,
  .line-group,
  .state-card,
  .mode-toggles { border: 1px solid CanvasText; }
}

/* Dark theme fine-tuning (same approach as the home page). */
:global(.v-theme--dark) .plan-page {
  --glass: rgba(var(--v-theme-surface), 0.66);
  --glass-border: rgba(var(--v-theme-on-surface), 0.075);
  --accent-tint: 0.035;
  --accent-border: 0.22;
}
</style>