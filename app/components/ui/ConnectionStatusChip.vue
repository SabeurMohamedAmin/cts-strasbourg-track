<!--
  ConnectionStatusChip (Step 3.3)

  SELF-HANDLING connection status indicator: it derives its own state
  from useConnectionStatus(), which maps the vehicles store (SSE
  connection state + data freshness) to a label / icon / color triple.

  Two presentations, selected with the `variant` prop:

    variant="row"  (default) — drawer footer list row:
                               colored icon + full label + status chip
    variant="chip"           — compact standalone pill for tight spots
                               (e.g. the Horaires header chips row)

  Usage:
    <ConnectionStatusChip />                 ← drawer footer
    <ConnectionStatusChip variant="chip" />  ← header pill
-->
<script setup lang="ts">
import { useConnectionStatus } from '~/composables/useConnectionStatus'

withDefaults(defineProps<{
  /** Visual presentation — see comment block above. */
  variant?: 'row' | 'chip'
}>(), {
  variant: 'row',
})

const { connectionLabel, connectionIcon, connectionColor } = useConnectionStatus()
</script>

<template>
  <!-- Compact pill — fits inline chip rows like the Horaires header -->
  <v-chip
    v-if="variant === 'chip'"
    :color="connectionColor"
    :prepend-icon="connectionIcon"
    size="small"
    variant="tonal"
  >
    {{ connectionLabel }}
  </v-chip>

  <!-- Full row — pinned in the drawer footer -->
  <v-list-item
    v-else
    density="compact"
    class="mx-2 my-1 rounded-lg"
  >
    <template #prepend>
      <v-icon :color="connectionColor" size="20" class="mr-3">
        {{ connectionIcon }}
      </v-icon>
    </template>
    <v-list-item-title class="text-body-2">
      {{ connectionLabel }}
    </v-list-item-title>
    <template #append>
      <v-chip :color="connectionColor" size="x-small" variant="tonal">
        {{ connectionLabel }}
      </v-chip>
    </template>
  </v-list-item>
</template>