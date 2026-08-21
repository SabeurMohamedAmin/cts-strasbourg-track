<script setup lang="ts">
  /**
   * Confirmation dialog for destructive admin actions — modeled on
   * FavoriteGroupDeleteDialog so both areas feel identical.
   *
   * Dumb component contract:
   *   props: modelValue — visibility, title / message — texts,
   *          confirmLabel — button text, loading — pending state,
   *          confirmDisabled — blocks the button until a condition is met
   *          (e.g. a reassign target has been picked)
   *   slot:  default — extra content under the message (e.g. the
   *          « reassign articles to… » select of the categories page)
   *   emits: update:modelValue — close request, confirm — user confirmed
   */
  withDefaults(defineProps<{
    modelValue: boolean
    title: string
    message: string
    confirmLabel?: string
    loading?: boolean
    confirmDisabled?: boolean
  }>(), {
    confirmLabel: 'Supprimer',
    loading: false,
    confirmDisabled: false,
  })

  const emit = defineEmits<{
    'update:modelValue': [value: boolean]
    'confirm': []
  }>()
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    class="admin-confirm"
    max-width="440"
    :z-index="2600"
    scrim="rgba(3, 8, 20, .68)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card
      class="admin-confirm__surface"
      rounded="xl"
      elevation="0"
      aria-labelledby="admin-confirm-title"
    >
      <v-card-title id="admin-confirm-title" class="d-flex align-center ga-3 pa-5 pb-2 text-wrap">
        <span class="admin-confirm__icon d-flex align-center justify-center rounded-lg" aria-hidden="true">
          <v-icon icon="mdi-delete-alert-outline" size="22" />
        </span>
        {{ title }}
      </v-card-title>

      <v-card-text class="text-body-2 text-medium-emphasis px-5">
        {{ message }}
        <slot />
      </v-card-text>

      <v-card-actions class="flex-wrap justify-end ga-2 pa-5 pt-2">
        <v-btn variant="text" rounded="lg" :min-height="44" @click="emit('update:modelValue', false)">
          Annuler
        </v-btn>
        <v-btn
          color="error"
          variant="flat"
          rounded="lg"
          :min-height="44"
          prepend-icon="mdi-delete-outline"
          :loading="loading"
          :disabled="confirmDisabled"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
/* Frosted scrim behind the dialog (same treatment as the stop picker). */
:global(.admin-confirm .v-overlay__scrim) {
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

/* Theme-aware surface with a subtle error glow, readable in both modes. */
.admin-confirm__surface {
  color: rgb(var(--v-theme-on-surface));
  background:
    radial-gradient(circle at 12% -15%, rgba(var(--v-theme-error), .14), transparent 18rem),
    rgb(var(--v-theme-surface)) !important;
  border: 1px solid rgba(var(--v-theme-on-surface), .12);
}

.admin-confirm__icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  color: rgb(var(--v-theme-error));
  background: rgba(var(--v-theme-error), .14);
}

/* Visible focus ring for keyboard users. */
.admin-confirm__surface :is(a, button):focus-visible {
  outline: 3px solid rgb(var(--v-theme-primary));
  outline-offset: 3px;
}
</style>
