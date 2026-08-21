<!--
  MapErrorAlert (Step 3.1)

  Prominent error alert with a retry action, shown when the network or the
  base map cannot be loaded.

  Dumb component contract:
    props:  message — the user-facing error text
    emits:  retry   — the user clicked « Réessayer »
            close   — the user dismissed the alert
-->
<script setup lang="ts">
defineProps<{
  /** User-facing error text (already localized). */
  message: string
}>()

const emit = defineEmits<{
  retry: []
  close: []
}>()
</script>

<template>
  <v-alert
    class="map-error"
    closable
    density="comfortable"
    icon="mdi-wifi-off"
    rounded="lg"
    title="Oups !"
    type="error"
    variant="elevated"
    @click:close="emit('close')"
  >
    {{ message }}
    <template #append>
      <v-btn
        color="white"
        prepend-icon="mdi-refresh"
        size="small"
        variant="tonal"
        @click="emit('retry')"
      >
        Réessayer
      </v-btn>
    </template>
  </v-alert>
</template>

<style scoped>
.map-error {
  position: absolute;
  top: 72px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 6;
  width: min(560px, calc(100% - 24px));
}
</style>
