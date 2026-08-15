<script setup lang="ts">
import type { ScheduleLine } from '~~/shared/types/schedule'

defineProps<{ lines: ScheduleLine[] }>()

/** routeId of the selected line. */
const model = defineModel<string>({ required: true })
</script>

<template>
  <v-btn-toggle
    v-model="model"
    mandatory
    density="comfortable"
    role="radiogroup"
    aria-label="Choisir une ligne de transport"
    class="line-toggles rounded-lg bg-blue"
    divided
  >
    <v-btn
      v-for="line in lines"
      :key="line.routeId"
      :value="line.routeId"
      role="radio"
      :aria-checked="model === line.routeId"
      size="small"
      variant="plain"
      class="line-pill px-2 py-1 my-2 text-label-medium border-none rounded-xl  text-sm-label-large font-weight-bold"
      :class="{ 'line-pill--active': model === line.routeId }"
      :style="{
        '--lc': `#${line.routeColor || 'c8102e'}`,
        '--lt': `#${line.routeTextColor || 'ffffff'}`,
      }"
      :aria-label="`Ligne ${line.lineLabel} — ${line.mode === 'tram' ? 'Tramway' : 'Bus'}`"
    >
      <v-icon
        :icon="line.mode === 'tram' ? 'mdi-tram' : 'mdi-bus'"
        size="15"
        start
        aria-hidden="true"
      />
      {{ line.lineLabel }}
    </v-btn>
  </v-btn-toggle>
</template>

<style scoped>
/* ── Group wrapper: transparent so pills float freely and wrap ── */
.line-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  background: transparent !important;
  box-shadow: none !important;
  height: auto !important;
}

/* v-btn-toggle adds internal borders between items via `divided`;
   since pills are visually separate, remove that seam. */
.line-toggles :deep(.v-btn-toggle__content),
.line-toggles :deep(.v-divider) {
  display: none;
}

/* ── Base pill ── */
.line-pill {
  min-height: 24px;          /* WCAG 2.5.8 target size */
  border-color: rgba(var(--v-theme-on-surface), 0.18) !important;
  color: rgba(var(--v-theme-on-surface), 0.72) !important;
  backdrop-filter: blur(4px);
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
  opacity: 1 !important; /* v-btn-toggle dims unselected items by default */
}

/* ── Hover (inactive only) ── */
.line-pill:not(.line-pill--active):hover {
  background: rgba(var(--v-theme-on-surface), 0.07) !important;
  border-color: rgba(var(--v-theme-on-surface), 0.28) !important;
}

/* ── Active / selected ── */
.line-pill--active {
  border-color: transparent !important;
  color: var(--lt) !important;
  background: var(--lc) !important;
  box-shadow: 0 3px 7px color-mix(in srgb, var(--lc) 25%, transparent);
}

.line-pill--active:hover {
  filter: brightness(1.07);
}

/* ── Focus ring (keyboard navigation) ── */
.line-pill:focus-visible {
  outline: 2.5px solid rgb(var(--v-theme-primary));
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .line-pill { transition: none; }
}
</style>