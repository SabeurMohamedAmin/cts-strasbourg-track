<!--
  DateChip

  SELF-HANDLING current-date indicator: it derives its own state from
  useCurrentDate(), which exposes a reactive day/month/year label plus
  a fixed icon / color pair.

  Same presentation contract as ConnectionStatusChip, selected with the
  `variant` prop:

    variant="row"  (default) — drawer footer list row:
                               colored icon + full label + date chip
    variant="chip"           — compact standalone pill for tight spots
                               (e.g. the Horaires header chips row)

  Usage:
    <DateChip />                 ← drawer footer
    <DateChip variant="chip" />  ← header pill
-->
<script setup lang="ts">
import { useCurrentDate } from '~/composables/useCurrentDate'

withDefaults(defineProps<{
  /** Visual presentation — see comment block above. */
  variant?: 'row' | 'chip'
}>(), {
  variant: 'row',
})

const { dateLabel, dateIcon, dateColor } = useCurrentDate()
</script>

<template>
  <!-- Compact pill — fits inline chip rows like the Horaires header -->
  <v-chip
    v-if="variant === 'chip'"
    :color="dateColor"
    :prepend-icon="dateIcon"
    size="small"
    variant="tonal"
  >
    {{ dateLabel }}
  </v-chip>

  <!-- Full row — for list contexts such as the drawer footer -->
  <v-list-item
    v-else
    density="compact"
    class="mx-2 my-1 rounded-lg"
  >
    <template #prepend>
      <v-icon :color="dateColor" size="20" class="mr-3">
        {{ dateIcon }}
      </v-icon>
    </template>
    <v-list-item-title class="text-body-2">
      {{ dateLabel }}
    </v-list-item-title>
    <template #append>
      <v-chip :color="dateColor" size="x-small" variant="tonal">
        {{ dateLabel }}
      </v-chip>
    </template>
  </v-list-item>
</template>
