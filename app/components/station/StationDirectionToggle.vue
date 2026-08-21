<script setup lang="ts">
import SwapDirectionIcon from '~/components/ui/SwapDirectionIcon.vue'

/**
 * Direction selector — same "mode-toggles" radio-group design as the
 * transport filter on the home page. Each line has (usually) two travel
 * directions; the parent passes their headsigns in a stable order.
 *
 * Each toggle shows the swap-horizontal glyph with ITS arrow highlighted
 * (outbound → right arrow, return → left arrow), so both options read as
 * two halves of the same journey.
 *
 * Typography scales with the screen through Vuetify text utility classes
 * (mobile-first, larger from the `sm` breakpoint up).
 */
defineProps<{ directions: string[] }>()

/** Index of the selected direction inside `directions`. */
const model = defineModel<number>({ required: true })

/**
 * Icon colors follow the toggle state for correct contrast in both themes:
 *   - selected toggle → its arrow pops in primary, the other stays faint
 *   - unselected toggle → muted arrow matching the label color
 */
function iconColors(index: number) {
  if (model.value === index) {
    return {
      active: 'rgb(var(--v-theme-primary))',
      inactive: 'rgba(var(--v-theme-on-surface), .28)',
    }
  }
  return {
    active: 'rgba(var(--v-theme-on-surface), .62)',
    inactive: 'rgba(var(--v-theme-on-surface), .22)',
  }
}
</script>

<template>
  <div class="direction-toggles rounded-lg pa-0"
    role="radiogroup"
    aria-label="Choisir une direction">
    <v-btn v-for="(headsign, index) in directions"
      :key="headsign"
      variant="plain"
      type="button"
      role="radio"
      class=" rounded-lg direction-toggle text-label-small text-sm-label-large"
      :class="{ 'direction-toggle--active': model === index }"
      :aria-checked="model === index"
      :aria-label="`Direction ${headsign}`"
      @click="model = index">
      <SwapDirectionIcon :direction="index === 0 ? 'right' : 'left'"
        :active-color="iconColors(index).active"
        :inactive-color="iconColors(index).inactive"
        :size="24" />
      <span class="direction-toggle__label text-break">
        {{ headsign }}
      </span>
    </v-btn>
  </div>
</template>

<style scoped>
.direction-toggles {
  display: flex;
  width: 100%;
  gap: 3px;
  border: 1px solid rgba(var(--v-theme-on-surface), .1);
  background: rgba(var(--v-theme-surface), .58);
}

.direction-toggle {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 24px;
  padding: 2px 4px;
  border: 0;
  color: rgba(var(--v-theme-on-surface), .62);
  background: transparent;
  cursor: pointer;
  transition: background .2s ease, color .2s ease, transform .12s ease;
}

.direction-toggle:active {
  transform: scale(.97);
}

.direction-toggle__label {
  /* Allow wrapping instead of forcing single line */
  min-width: 0;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  /* clamp to 2 lines, ellipsis if a 3rd would appear */
  line-clamp: 2;

  white-space: normal;
  /* override any nowrap */
  overflow: hidden;
  text-overflow: ellipsis;

  word-break: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
  /* breaks long French words like "l'Entreprise" cleanly */
  text-align: center;
  line-height: 1;

  /* Reserve space for 2 lines so buttons in the same row stay aligned */
  display: flex;
  /* fallback if line-clamp unsupported */
  align-items: center;
  justify-content: center;
}

.direction-toggle--active {
  color: rgba(var(--v-theme-on-surface), .95);
  background: rgba(var(--v-theme-primary), .12);
  box-shadow: inset 0 0 0 1px rgba(var(--v-theme-primary), .3);
}

.direction-toggle:focus-visible {
  outline: 3px solid rgb(var(--v-theme-primary));
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .direction-toggle {
    transition: none;
  }
}
</style>
