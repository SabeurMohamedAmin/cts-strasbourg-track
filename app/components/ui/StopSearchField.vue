<!--
  StopSearchField (Step 3.3)

  The stop search input. Debouncing and result state live in the parent —
  this component only renders the field and forwards keyboard intent.

  Dumb component contract:
    props:  model-value — the raw query text (v-model)
            loading     — shows the inline loading bar
    emits:  update:modelValue — text changed (Escape clears to '')
            move-focus(±1)    — arrow key pressed
            select-focused    — Enter pressed
-->
<script setup lang="ts">
defineProps<{
  modelValue: string
  loading: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'move-focus': [delta: number]
  'select-focused': []
}>()
</script>

<template>
  <v-text-field
    :model-value="modelValue"
    clearable
    density="compact"
    hide-details
    placeholder="Rechercher un arrêt…"
    prepend-inner-icon="mdi-magnify"
    rounded="lg"
    variant="outlined"
    :loading="loading"
    @update:model-value="emit('update:modelValue', $event ?? '')"
    @keydown.down.prevent="emit('move-focus', 1)"
    @keydown.up.prevent="emit('move-focus', -1)"
    @keydown.enter.prevent="emit('select-focused')"
    @keydown.esc="emit('update:modelValue', '')"
  />
</template>
