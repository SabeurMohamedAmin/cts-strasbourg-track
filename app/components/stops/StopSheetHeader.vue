<!--
  StopSheetHeader (Step 3.2)

  Header of the stop bottom sheet: stop icon, name, distance chip and the
  favourite / close actions.

  Favourite UX (moved with the code from StopSheet):
    • Stop not in any list → mdi-star-plus-outline btn, neutral, v-ripple
      to invite interaction.
    • Stop in ≥1 list      → filled amber mdi-star + v-badge showing how
      many lists contain it.
    Clicking either state emits 'open-picker'; the parent opens the
    favourite list picker dialog.

  Dumb component contract:
    props:  stop-name       — station display name
            distance-label  — walking distance text, null hides the chip
            list-count      — number of favourite lists containing the stop
    emits:  open-picker     — the user clicked the star
            close           — the user clicked the close button
-->
<script setup lang="ts">
defineProps<{
  stopName: string
  distanceLabel: string | null
  listCount: number
}>()

const emit = defineEmits<{
  'open-picker': []
  'close': []
}>()
</script>

<template>
  <v-card-title class="station-header d-flex align-center ga-3 px-4 pt-2 pb-3">
    <v-avatar color="primary" variant="tonal" size="44" rounded="lg">
      <v-icon icon="mdi-bus-stop" size="25" />
    </v-avatar>

    <div class="flex-grow-1 min-width-0">
      <div class="text-h6 font-weight-bold text-truncate station-name">
        {{ stopName }}
      </div>
      <div class="d-flex align-center flex-wrap ga-2 mt-1">
        <span class="text-caption text-medium-emphasis">Station CTS</span>
        <v-chip
          v-if="distanceLabel"
          prepend-icon="mdi-walk"
          size="x-small"
          variant="tonal"
          color="primary"
        >
          {{ distanceLabel }}
        </v-chip>
      </div>
    </div>

    <!--
      Star-plus favourite button.
      - 0 lists: outlined star-plus, neutral, subtle pulse + ripple.
      - ≥1 list : filled amber star, badge with list count, ripple.
      Always emits 'open-picker' on click.
    -->
    <v-badge
      :model-value="listCount > 0"
      :content="listCount"
      color="amber"
      size="x-small"
      location="top end"
      floating
    >
      <v-btn
        v-ripple
        :icon="listCount > 0 ? 'mdi-star' : 'mdi-star-plus-outline'"
        :color="listCount > 0 ? 'amber' : undefined"
        variant="text"
        size="small"
        :aria-label="listCount > 0
          ? `Dans ${listCount} liste${listCount > 1 ? 's' : ''} — modifier`
          : 'Ajouter aux favoris'"
        @click="emit('open-picker')"
      />
    </v-badge>

    <v-btn
      icon="mdi-close"
      variant="text"
      size="small"
      aria-label="Fermer"
      @click="emit('close')"
    />
  </v-card-title>
</template>

<style scoped>
.station-header { min-height: 68px; }
.station-name { line-height: 1.2; }

@media (max-width: 600px) {
  .station-name { font-size: 1.1rem !important; }
}
</style>
