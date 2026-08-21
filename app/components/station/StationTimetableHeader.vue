<script setup lang="ts">
/**
 * Heading of the theoretical timetable: the title, the service date and the
 * direction the hours below belong to.
 */
defineProps<{
  /** Service date for the reader, e.g. "15/8/2026". Empty hides the chip. */
  dateLabel?: string
  /** Destination of the selected direction. */
  headsign?: string
}>()
</script>

<template>
  <v-card rounded="lg" variant="outlined" elevation="0" class="timetable-header pa-2 mb-3">
    <div class="d-flex align-start justify-space-between gap-3">
      <div>
        <h2
          id="timetable-heading"
          class="ma-0 text-title-large text-sm-headline-small font-weight-bold mb-1"
        >
          Horaires
        </h2>
        <p class="text-body-small text-sm-body-medium text-medium-emphasis my-0">
          Théoriques
        </p>
      </div>

      <v-chip
        v-if="dateLabel"
        color="error"
        variant="flat"
        rounded="pill"
        size="small"
        :aria-label="`Date des horaires : ${dateLabel}`"
      >
        {{ dateLabel }}
      </v-chip>
    </div>

    <template v-if="headsign">
      <v-divider class="my-3" />
      <div class="d-flex align-center gap-1 timetable-direction" role="status" aria-live="polite">
        <v-icon icon="mdi-arrow-right-thin" size="18" color="primary" aria-hidden="true" />
        <span class="text-body-medium text-sm-body-large font-weight-medium">
          {{ headsign }}
        </span>
      </div>
    </template>
  </v-card>
</template>

<style scoped>
.timetable-header {
  border-color: rgba(var(--v-theme-on-surface), .1) !important;
  background: rgba(var(--v-theme-surface), .5);
}

.timetable-direction {
  color: rgba(var(--v-theme-on-surface), .85);
}
</style>
