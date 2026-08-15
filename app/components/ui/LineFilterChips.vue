<script setup lang="ts">
import { useLinesStore } from '~/stores/lines'

const linesStore = useLinesStore()

const BUS_PREVIEW = 14

const open = ref(false)
const busExpanded = ref(false)

watch(open, (val) => { if (!val) busExpanded.value = false })

const showTrams = computed(() => linesStore.activeModes.includes('tram'))
const showBuses = computed(() => linesStore.activeModes.includes('bus'))

const tramLines = computed(() =>
  linesStore.lines.filter(l => l.routeType === 0),
)

const busLines = computed(() =>
  linesStore.lines
    .filter(l => l.routeType === 3)
    .slice()
    .sort((a, b) => {
      const na = Number.parseInt(a.routeShortName) || 0
      const nb = Number.parseInt(b.routeShortName) || 0
      return na !== nb ? na - nb : a.routeShortName.localeCompare(b.routeShortName)
    }),
)

const busPreview = computed(() => busLines.value.slice(0, BUS_PREVIEW))
const busRemainder = computed(() => busLines.value.slice(BUS_PREVIEW))

const activeCount = computed(() => linesStore.activeLineIds.size)

const allTramsActive = computed(
  () => tramLines.value.length > 0
    && tramLines.value.every(l => linesStore.isActive(l.routeId)),
)
const allBusesActive = computed(
  () => busLines.value.length > 0
    && busLines.value.every(l => linesStore.isActive(l.routeId)),
)
const noTramsActive = computed(() =>
  tramLines.value.every(line => !linesStore.isActive(line.routeId)),
)
const noBusesActive = computed(() =>
  busLines.value.every(line => !linesStore.isActive(line.routeId)),
)

/** Explicit bulk actions: these never toggle based on current state. */
function selectAll(mode: 'tram' | 'bus') {
  linesStore.selectAllInMode(mode)
}

function selectNone(mode: 'tram' | 'bus') {
  linesStore.deselectAllInMode(mode)
}

interface Route { routeColor: string, routeTextColor: string }

function chipStyle(line: Route): Record<string, string> {
  const bg = `#${line.routeColor}`
  const fg = `#${line.routeTextColor}`
  return { '--chip-bg': bg, '--chip-fg': fg, '--chip-border': bg }
}
</script>

<template>
  <!--
    Line filter panel — bottom-left, collapsed by default.

    Collapsed : slim pill showing mode icons + active line count.
    Expanded  : card with two sections.
      • Trams — horizontal scroll row (only ~6 lines, so a row is fine).
      • Bus   — wrapping chip grid, first BUS_PREVIEW lines shown;
                 "Voir tout" button reveals the rest with a smooth transition.
  -->
  <div class="lfp-shell" :class="{ 'lfp-shell--open': open }">

    <!-- ── Handle pill (always visible) ────────────────────────────────────── -->
    <button
      class="lfp-handle"
      :aria-expanded="open"
      aria-label="Filtres lignes"
      @click="open = !open"
      @keydown.enter.prevent="open = !open"
      @keydown.space.prevent="open = !open"
    >
      <span class="lfp-handle__icons">
        <v-icon
          :icon="showTrams ? 'mdi-train-variant' : 'mdi-train-variant-off'"
          :class="showTrams ? 'lfp-icon--on' : 'lfp-icon--off'"
          size="18"
        />
        <v-icon
          :icon="showBuses ? 'mdi-bus' : 'mdi-bus-off'"
          :class="showBuses ? 'lfp-icon--on' : 'lfp-icon--off'"
          size="18"
        />
      </span>

      <span class="lfp-handle__label">
        {{ activeCount }}
        <span class="lfp-handle__label-sub">ligne{{ activeCount !== 1 ? 's' : '' }}</span>
      </span>

      <v-icon
        :icon="open ? 'mdi-chevron-down' : 'mdi-chevron-up'"
        size="16"
        class="lfp-handle__chevron"
      />
    </button>

    <!-- ── Expanded panel ─────────────────────────────────────────────── -->
    <transition name="lfp-slide">
      <div v-if="open" class="lfp-panel" role="group" aria-label="Filtres par ligne">

        <!-- ── Tram section ──────────────────────────────────────────── -->
        <section class="lfp-section">
          <div class="lfp-section__header">
            <!-- Mode toggle btn (Trams) -->
            <button
              class="lfp-mode-btn"
              :class="{ 'lfp-mode-btn--on': showTrams }"
              :aria-pressed="showTrams"
              @click="linesStore.toggleMode('tram')"
            >
              <v-icon icon="mdi-train-variant" size="14" />
              Trams
            </button>

            <div v-if="tramLines.length" class="lfp-bulk-actions">
              <button
                class="lfp-all-btn"
                :class="{ 'lfp-all-btn--active': allTramsActive }"
                :disabled="allTramsActive"
                @click="selectAll('tram')"
              >
                Tous
              </button>
              <button
                class="lfp-all-btn"
                :class="{ 'lfp-all-btn--active': noTramsActive }"
                :disabled="noTramsActive"
                @click="selectNone('tram')"
              >
                Aucun
              </button>
            </div>
          </div>

          <!-- Trams: horizontal scroll row (few items) -->
          <div v-if="showTrams && tramLines.length" class="lfp-row" role="list">
            <button
              v-for="line in tramLines"
              :key="line.routeId"
              class="lfp-chip"
              :class="{ 'lfp-chip--active': linesStore.isActive(line.routeId) }"
              :style="chipStyle(line)"
              :aria-pressed="linesStore.isActive(line.routeId)"
              role="listitem"
              @click="linesStore.toggleLine(line.routeId)"
            >
              {{ line.routeShortName }}
            </button>
          </div>
          <p v-else-if="!showTrams" class="lfp-muted">Mode tram désactivé</p>
        </section>

        <div class="lfp-divider" />

        <!-- ── Bus section ───────────────────────────────────────────── -->
        <section class="lfp-section">
          <div class="lfp-section__header">
            <button
              class="lfp-mode-btn"
              :class="{ 'lfp-mode-btn--on': showBuses }"
              :aria-pressed="showBuses"
              @click="linesStore.toggleMode('bus')"
            >
              <v-icon icon="mdi-bus" size="14" />
              Bus
            </button>

            <div v-if="busLines.length" class="lfp-bulk-actions">
              <button
                class="lfp-all-btn"
                :class="{ 'lfp-all-btn--active': allBusesActive }"
                :disabled="allBusesActive"
                @click="selectAll('bus')"
              >
                Tous
              </button>
              <button
                class="lfp-all-btn"
                :class="{ 'lfp-all-btn--active': noBusesActive }"
                :disabled="noBusesActive"
                @click="selectNone('bus')"
              >
                Aucun
              </button>
            </div>
          </div>

          <template v-if="showBuses && busLines.length">
            <div class="lfp-grid" role="list">
              <button
                v-for="line in busPreview"
                :key="line.routeId"
                class="lfp-chip"
                :class="{ 'lfp-chip--active': linesStore.isActive(line.routeId) }"
                :style="chipStyle(line)"
                :aria-pressed="linesStore.isActive(line.routeId)"
                role="listitem"
                @click="linesStore.toggleLine(line.routeId)"
              >
                {{ line.routeShortName }}
              </button>

              <div
                v-if="busRemainder.length"
                class="lfp-grid__overflow"
                :class="{ 'lfp-grid__overflow--open': busExpanded }"
              >
                <button
                  v-for="line in busRemainder"
                  :key="line.routeId"
                  class="lfp-chip"
                  :class="{ 'lfp-chip--active': linesStore.isActive(line.routeId) }"
                  :style="chipStyle(line)"
                  :aria-pressed="linesStore.isActive(line.routeId)"
                  role="listitem"
                  @click="linesStore.toggleLine(line.routeId)"
                >
                  {{ line.routeShortName }}
                </button>
              </div>
            </div>

            <button
              v-if="busRemainder.length"
              class="lfp-expand-btn"
              :aria-expanded="busExpanded"
              @click="busExpanded = !busExpanded"
            >
              <v-icon
                :icon="busExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                size="14"
              />
              {{ busExpanded ? 'Réduire' : `Voir tout (${busLines.length} lignes)` }}
            </button>
          </template>

          <p v-else-if="!showBuses" class="lfp-muted">Mode bus désactivé</p>
        </section>

      </div>
    </transition>
  </div>
</template>

<style scoped>
/* ─ Shell ───────────────────────────────────────────────────────────────── */
.lfp-shell {
  position: fixed;
  bottom: 16px;
  left: 16px;
  z-index: 1000;
  width: min(400px, calc(100vw - 32px));
  display: flex;
  flex-direction: column-reverse;
  gap: 4px;
}

/* ─ Handle ───────────────────────────────────────────────────────────── */
.lfp-handle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 44px;
  /* Glassy pill: translucent surface + frosted blur (theme-aware) */
  background: rgba(var(--v-theme-surface), 0.62);
  backdrop-filter: blur(16px) saturate(1.5);
  -webkit-backdrop-filter: blur(16px) saturate(1.5);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 22px;
  box-shadow: 0 2px 8px rgba(0,0,0,.18);
  cursor: pointer;
  user-select: none;
  transition: box-shadow 160ms ease, background 160ms ease;
  align-self: flex-start;
}
.lfp-handle:hover,
.lfp-handle:focus-visible {
  box-shadow: 0 4px 16px rgba(0,0,0,.26);
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
.lfp-handle__icons  { display: flex; gap: 4px; }
.lfp-icon--on       { color: rgb(var(--v-theme-primary)); }
.lfp-icon--off      { color: rgba(var(--v-theme-on-surface), 0.35); }
.lfp-handle__label  { font-size: .875rem; font-weight: 600; color: rgb(var(--v-theme-on-surface)); line-height: 1; }
.lfp-handle__label-sub { font-size: .75rem; font-weight: 400; margin-left: 2px; color: rgba(var(--v-theme-on-surface), .6); }
.lfp-handle__chevron   { color: rgba(var(--v-theme-on-surface), .5); margin-left: auto; }

/* ─ Panel card ──────────────────────────────────────────────────────── */
.lfp-panel {
  /* Glassy card: slightly more opaque than the pill so chips stay legible */
  background: rgba(var(--v-theme-surface), 0.72);
  backdrop-filter: blur(20px) saturate(1.6);
  -webkit-backdrop-filter: blur(20px) saturate(1.6);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 14px;
  box-shadow: 0 6px 24px rgba(0,0,0,.22);
  max-height: min(70dvh, 520px);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--v-theme-on-surface), .15) transparent;
  padding-bottom: 4px;
}

/* ─ Slide transition ────────────────────────────────────────────────── */
.lfp-slide-enter-active,
.lfp-slide-leave-active { transition: opacity 180ms ease, transform 200ms cubic-bezier(.16,1,.3,1); }
.lfp-slide-enter-from,
.lfp-slide-leave-to     { opacity: 0; transform: translateY(8px); }

/* ─ Section ──────────────────────────────────────────────────────────── */
.lfp-section          { padding: 8px 10px 6px; }
.lfp-section__header  { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }

.lfp-mode-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 10px 2px 6px; height: 28px;
  border: 1.5px solid rgba(var(--v-border-color), 0.22);
  border-radius: 14px; font-size: .75rem; font-weight: 600;
  letter-spacing: .03em; cursor: pointer;
  color: rgba(var(--v-theme-on-surface), .55);
  background: transparent;
  transition: background 140ms, color 140ms, border-color 140ms;
}
.lfp-mode-btn--on {
  background: rgba(var(--v-theme-primary), .12);
  color: rgb(var(--v-theme-primary));
  border-color: rgb(var(--v-theme-primary));
}

.lfp-bulk-actions {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: 14px;
  background: rgba(var(--v-theme-on-surface), .07);
}
.lfp-all-btn {
  font-size: .7rem; font-weight: 600;
  padding: 2px 9px; height: 24px; border: none;
  border-radius: 12px;
  background: transparent;
  color: rgba(var(--v-theme-on-surface), .65);
  cursor: pointer;
  transition: background 140ms, color 140ms, opacity 140ms;
}
.lfp-all-btn:hover:not(:disabled) { background: rgba(var(--v-theme-on-surface), .12); }
.lfp-all-btn--active {
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-primary));
  box-shadow: 0 1px 3px rgba(0,0,0,.14);
}
.lfp-all-btn:disabled { cursor: default; opacity: 1; }

/* ─ Tram row ─────────────────────────────────────────────────────────── */
.lfp-row { display: flex; gap: 5px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
.lfp-row::-webkit-scrollbar { display: none; }

/* ─ Bus grid ─────────────────────────────────────────────────────────── */
.lfp-grid { display: flex; flex-wrap: wrap; gap: 5px; }

.lfp-grid__overflow {
  display: flex; flex-wrap: wrap; gap: 5px; width: 100%;
  max-height: 0; overflow: hidden;
  transition: max-height 280ms cubic-bezier(.16,1,.3,1);
}
.lfp-grid__overflow--open { max-height: 260px; }

/* ─ Show-more button ─────────────────────────────────────────────────── */
.lfp-expand-btn {
  display: flex; align-items: center; gap: 4px;
  margin-top: 6px; padding: 4px 10px; width: 100%; height: 28px;
  border: 1px dashed rgba(var(--v-border-color), 0.3);
  border-radius: 8px; font-size: .72rem; font-weight: 500;
  color: rgba(var(--v-theme-on-surface), .55);
  background: transparent; cursor: pointer; justify-content: center;
  transition: background 140ms, color 140ms;
}
.lfp-expand-btn:hover {
  background: rgba(var(--v-theme-on-surface), .06);
  color: rgba(var(--v-theme-on-surface), .8);
}

/* ─ Chip ────────────────────────────────────────────────────────────────── */
.lfp-chip {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 36px; height: 36px; padding: 0 6px;
  border-radius: 8px; font-size: .78rem; font-weight: 700;
  letter-spacing: .01em; white-space: nowrap;
  cursor: pointer; flex-shrink: 0;
  background: transparent;
  border: 2px solid var(--chip-border);
  color: var(--chip-border);
  transition: background 130ms, color 130ms, opacity 130ms, transform 90ms;
}
.lfp-chip--active   { background: var(--chip-bg); color: var(--chip-fg); border-color: var(--chip-bg); }
.lfp-chip:hover     { opacity: .82; }
.lfp-chip:active    { transform: scale(.9); }

/* ─ Misc ──────────────────────────────────────────────────────────────── */
.lfp-divider { height: 1px; background: rgba(var(--v-border-color), 0.12); margin: 0 10px; }
.lfp-muted   { font-size: .75rem; color: rgba(var(--v-theme-on-surface), .45); margin: 4px 0 2px; padding: 0; }

@media (max-width: 600px) {
  .lfp-shell { bottom: 12px; left: 12px; }
  .lfp-panel { border-radius: 12px; }
  .lfp-chip  { min-width: 32px; height: 32px; font-size: .72rem; }
}
</style>
