<script setup lang="ts">
  /**
   * Success / error feedback after every admin mutation — no silent
   * failures (Phase 8 rule).
   *
   * Dumb component contract:
   *   props: modelValue — visibility, text — message,
   *          type — 'success' (default) or 'error'
   *   emits: update:modelValue — close request
   */
  withDefaults(defineProps<{
    modelValue: boolean
    text: string
    type?: 'success' | 'error'
  }>(), {
    type: 'success',
  })

  const emit = defineEmits<{
    'update:modelValue': [value: boolean]
  }>()
</script>

<template>
  <v-snackbar
    :model-value="modelValue"
    :color="type"
    :timeout="4000"
    location="bottom right"
    rounded="lg"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <span class="d-flex align-center ga-2">
      <v-icon
        :icon="type === 'success' ? 'mdi-check-circle-outline' : 'mdi-alert-circle'"
        size="20"
        aria-hidden="true"
      />
      {{ text }}
    </span>

    <template #actions>
      <v-btn variant="text" icon="mdi-close" aria-label="Fermer" @click="emit('update:modelValue', false)" />
    </template>
  </v-snackbar>
</template>
