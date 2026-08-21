<!--
  ServedLineChips (Step 3.2)

  The « Lignes à cette station » section: one colored chip per line, each
  toggling the visibility of the corresponding route track on the map.

  Dumb component contract:
    props:  lines           — lines serving the station (already sorted)
            active-line-ids — routeIds whose track is currently visible
    emits:  toggle(routeId) — the user clicked a line chip
-->
<script setup lang="ts">
import { lineStyle } from '~/utils/format'

/** Minimal line shape needed to render a chip. */
interface ServedLine {
  routeId: string
  routeShortName: string
  routeColor: string
  routeTextColor: string
}

const props = defineProps<{
  lines: ServedLine[]
  activeLineIds: string[]
}>()

const emit = defineEmits<{
  toggle: [routeId: string]
}>()

// Set lookup keeps the template O(1) per chip.
const activeIds = computed(() => new Set(props.activeLineIds))
</script>

<template>
  <section class="served-lines px-4 py-3">
    <div class="d-flex align-center justify-space-between mb-2">
      <div>
        <div class="text-subtitle-2 font-weight-bold">Lignes à cette station</div>
        <div class="text-caption text-medium-emphasis">Afficher ou masquer leur tracé</div>
      </div>
      <v-icon icon="mdi-map-marker-path" color="primary" size="22" />
    </div>
    <div class="d-flex flex-wrap ga-2" role="group" aria-label="Lignes desservant cette station">
      <button
        v-for="line in lines"
        :key="line.routeId"
        class="station-line-btn"
        :class="{ 'station-line-btn--active': activeIds.has(line.routeId) }"
        :style="lineStyle(line)"
        :aria-pressed="activeIds.has(line.routeId)"
        :aria-label="`${activeIds.has(line.routeId) ? 'Masquer' : 'Afficher'} la ligne ${line.routeShortName}`"
        @click="emit('toggle', line.routeId)"
      >
        <span class="station-line-btn__badge">{{ line.routeShortName }}</span>
        <v-icon
          :icon="activeIds.has(line.routeId) ? 'mdi-eye' : 'mdi-eye-off-outline'"
          size="16"
        />
      </button>
    </div>
  </section>
</template>

<style scoped>
.served-lines { background: rgba(var(--v-theme-on-surface), .018); }
.station-line-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 36px;
  padding: 3px 9px 3px 3px;
  border: 1px solid rgba(var(--v-border-color), .18);
  border-radius: 10px;
  color: rgba(var(--v-theme-on-surface), .55);
  background: rgba(var(--v-theme-surface), 0.5);
  cursor: pointer;
  transition: transform 120ms ease, border-color 150ms ease, box-shadow 150ms ease;
}
.station-line-btn:hover { transform: translateY(-1px); border-color: var(--line-color); }
.station-line-btn--active {
  color: rgb(var(--v-theme-on-surface));
  border-color: var(--line-color);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--line-color) 22%, transparent);
}
.station-line-btn__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 28px;
  padding-inline: 6px;
  border-radius: 7px;
  background: var(--line-color);
  color: var(--line-text);
  font-size: .75rem;
  font-weight: 800;
}
</style>
