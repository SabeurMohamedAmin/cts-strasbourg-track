<script setup lang="ts">
  /**
   * Title row shared by every admin page.
   *
   * Dumb component contract:
   *   props: title — h1 text, subtitle — optional helper line
   *   slot:  actions — buttons aligned to the right (e.g. « Nouvel article »)
   */
  defineProps<{
    title: string
    subtitle?: string
  }>()
</script>

<template>
  <header class="d-flex flex-wrap align-center ga-4 mb-6">
    <div class="flex-grow-1">
      <h1 class="text-h5 font-weight-bold">
        {{ title }}
      </h1>
      <p v-if="subtitle" class="text-body-2 text-medium-emphasis mb-0">
        {{ subtitle }}
      </p>
    </div>
    <div class="d-flex align-center ga-2">
      <slot name="actions" />
    </div>
  </header>
</template>
