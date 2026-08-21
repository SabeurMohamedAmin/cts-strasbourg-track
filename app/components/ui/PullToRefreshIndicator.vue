<script setup lang="ts">
defineProps<{
  distance: number
  progress: number
  ready: boolean
  refreshing: boolean
  visible: boolean
}>()
</script>

<template>
  <div
    class="pull-indicator"
    :class="{ 'pull-indicator--visible': visible }"
    :style="{ transform: `translate(-50%, ${Math.max(0, distance - 48)}px)` }"
    role="status"
    aria-live="polite"
  >
    <v-progress-circular
      v-if="refreshing"
      color="primary"
      indeterminate
      size="22"
      width="2"
    />
    <v-icon
      v-else
      color="primary"
      icon="mdi-arrow-down"
      size="22"
      :style="{ transform: `rotate(${progress * 180}deg)` }"
    />
    <span>{{ refreshing ? 'Actualisation…' : ready ? 'Relâchez pour actualiser' : 'Tirez pour actualiser' }}</span>
  </div>
</template>

<style scoped>
.pull-indicator {
  position: absolute;
  z-index: 10;
  top: 8px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 8px 13px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 999px;
  color: rgba(var(--v-theme-on-surface), 0.78);
  background: rgba(var(--v-theme-surface), 0.94);
  box-shadow: 0 5px 18px rgba(0, 0, 0, 0.16);
  font-size: 0.75rem;
  font-weight: 700;
  opacity: 0;
  pointer-events: none;
  transition: opacity 140ms ease, transform 140ms ease;
  white-space: nowrap;
}

.pull-indicator--visible { opacity: 1; }
.pull-indicator :deep(.v-icon) { transition: transform 140ms ease; }

@media (prefers-reduced-motion: reduce) {
  .pull-indicator,
  .pull-indicator :deep(.v-icon) { transition: none; }
}
</style>
