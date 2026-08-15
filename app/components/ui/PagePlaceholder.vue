<template>
  <!--
    Centered "coming soon" state used by pages that are not implemented
    yet (Horaires, Favoris, Plan). Delete this component once every page
    has real content.
  -->
  <div class="placeholder">
    <v-icon :icon="icon" size="64" color="primary" class="mb-4" />
    <h1 class="text-h5 font-weight-bold mb-2">{{ title }}</h1>
    <p class="text-body-2 text-medium-emphasis placeholder-text">
      {{ description }}
    </p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  /** MDI icon name, e.g. "mdi-clock-outline". */
  icon: string
  /** Page title shown under the icon. */
  title: string
  /** Short sentence describing what this page will offer. */
  description: string
}>()
</script>

<style scoped>
.placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px;
}

.placeholder-text {
  max-width: 360px;
}
</style>
