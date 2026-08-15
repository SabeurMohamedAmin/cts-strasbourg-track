<template>
  <!--
    StopToggleButtons
    Two stacked pill buttons — one for tram stations, one for bus stations.
    Each button independently shows/hides its corresponding stop layer.

    Position: fixed, bottom-right corner, above the LineFilterChips bar.
    The two buttons are grouped inside a v-btn-group so they share a
    single border-radius arc and look like a cohesive control.
  -->
  <div class="stop-toggle-group" role="group" aria-label="Affichage des stations">

    <!-- ── Tram toggle ──────────────────────────────────────────────────── -->
    <v-tooltip
      :text="tramVisible ? 'Masquer stations tram' : 'Afficher stations tram'"
      location="left"
    >
      <template #activator="{ props: tip }">
        <v-btn
          v-bind="tip"
          class="toggle-btn"
          :class="{ 'glass-surface': !tramVisible }"
          :color="tramVisible ? 'primary' : undefined"
          :aria-label="tramVisible ? 'Masquer les stations de tram' : 'Afficher les stations de tram'"
          :aria-pressed="tramVisible"
          elevation="4"
          rounded="t-lg"
          size="40"
          icon
          @click="$emit('toggleTram')"
        >
          <v-icon icon="mdi-tram" size="20" />

          <!-- Small eye-off badge when hidden -->
          <v-badge
            v-if="!tramVisible"
            color="error"
            icon="mdi-eye-off"
            floating
            inline
            class="state-badge"
          />
        </v-btn>
      </template>
    </v-tooltip>

    <!-- Thin divider between the two buttons -->
    <div class="toggle-divider" aria-hidden="true" />

    <!-- ── Bus toggle ───────────────────────────────────────────────────── -->
    <v-tooltip
      :text="busVisible ? 'Masquer stations bus' : 'Afficher stations bus'"
      location="left"
    >
      <template #activator="{ props: tip }">
        <v-btn
          v-bind="tip"
          class="toggle-btn"
          :class="{ 'glass-surface': !busVisible }"
          :color="busVisible ? 'blue-darken-2' : undefined"
          :aria-label="busVisible ? 'Masquer les stations de bus' : 'Afficher les stations de bus'"
          :aria-pressed="busVisible"
          elevation="0"
          rounded="b-lg"
          size="40"
          icon
          @click="$emit('toggleBus')"
        >
          <v-icon icon="mdi-bus" size="20" />

          <!-- Small eye-off badge when hidden -->
          <v-badge
            v-if="!busVisible"
            color="error"
            icon="mdi-eye-off"
            floating
            inline
            class="state-badge"
          />
        </v-btn>
      </template>
    </v-tooltip>
  </div>
</template>

<script setup lang="ts">
/**
 * Props
 *   tramVisible — current tram visibility state (controlled by parent)
 *   busVisible  — current bus visibility state (controlled by parent)
 *
 * Emits
 *   toggleTram — parent flips useTramStopLayer.stationsVisible
 *   toggleBus  — parent flips useBusStopLayer.stationsVisible
 */
defineProps<{
  tramVisible: boolean
  busVisible: boolean
}>()

defineEmits<{
  toggleTram: []
  toggleBus: []
}>()
</script>

<style scoped>
/*
  Fixed position: bottom-right, stacked vertically.
  z-index 400 keeps the group above the MapLibre canvas (z-index 0)
  but below Vuetify's overlay layer (z-index 2000).
*/
.stop-toggle-group {
  position: fixed;
  bottom: 16px;
  right: 12px;
  z-index: 400;
  display: flex;
  flex-direction: column-reverse;
  
  /* Remove gap so the two buttons touch and share a connected visual */
  gap: 0;
  /* Outer shadow wraps the entire group */
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.22));
}

.toggle-btn {
  /* Ensure both buttons are the same width */
  width: 40px !important;
  transition:
    background-color 220ms cubic-bezier(0.16, 1, 0.3, 1),
    color 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* 1 px separator between the two buttons */
.toggle-divider {
  height: 1px;
  background-color: rgba(0, 0, 0, 0.12);
}

/* The eye-off badge sits in the top-right corner of its button */
.state-badge {
  position: absolute;
  top: 2px;
  right: 2px;
}

/* On small phones, nudge up to avoid the chips bar */
@media (max-width: 400px) {
  .stop-toggle-group { bottom: 90px; }
}
</style>
