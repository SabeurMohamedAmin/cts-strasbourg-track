<script setup lang="ts">
/**
 * Confirmation dialog shown before deleting a favourite group.
 *
 * Dumb component contract:
 *   props: modelValue — dialog visibility, groupName — name shown in title
 *   emits: update:modelValue — close request, confirm — user confirmed
 */
defineProps<{
  modelValue: boolean
  groupName: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
}>()

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <!--
    Explicit z-index keeps the dialog above every floating element of the
    app chrome (menu FAB, bottom nav, glass panels). The scrim matches the
    stop-picker dialog for a consistent overlay look.
  -->
  <v-dialog
    :model-value="modelValue"
    class="delete-dialog"
    max-width="440"
    :z-index="2600"
    scrim="rgba(3, 8, 20, .68)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card
      class="delete-dialog__surface"
      rounded="xl"
      elevation="0"
      aria-labelledby="delete-group-title"
    >
      <v-card-title id="delete-group-title" class="d-flex align-center ga-3 pa-5 pb-2 text-wrap">
        <span class="delete-dialog__icon d-flex align-center justify-center rounded-lg" aria-hidden="true">
          <v-icon icon="mdi-delete-alert-outline" size="22" />
        </span>
        Supprimer « {{ groupName }} » ?
      </v-card-title>

      <v-card-text class="text-body-2 text-medium-emphasis px-5">
        Ce groupe sera définitivement supprimé. Cette action est irréversible.
      </v-card-text>

      <v-card-actions class="flex-wrap justify-end ga-2 pa-5 pt-2">
        <v-btn variant="text" rounded="lg" :min-height="44" @click="close">
          Annuler
        </v-btn>
        <v-btn
          color="error"
          variant="flat"
          rounded="lg"
          :min-height="44"
          prepend-icon="mdi-delete-outline"
          @click="emit('confirm')"
        >
          Supprimer le groupe
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
/* Frosted scrim behind the dialog (same treatment as the stop picker). */
:global(.delete-dialog .v-overlay__scrim) {
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

/* Theme-aware surface with a subtle error glow, readable in both modes. */
.delete-dialog__surface {
  color: rgb(var(--v-theme-on-surface));
  background:
    radial-gradient(circle at 12% -15%, rgba(var(--v-theme-error), .14), transparent 18rem),
    rgb(var(--v-theme-surface)) !important;
  border: 1px solid rgba(var(--v-theme-on-surface), .12);
}

.delete-dialog__icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  color: rgb(var(--v-theme-error));
  background: rgba(var(--v-theme-error), .14);
}

/* Visible focus ring on the dark surface. */
.delete-dialog__surface :is(a, button):focus-visible {
  outline: 3px solid rgb(var(--v-theme-primary));
  outline-offset: 3px;
}
</style>
