<script setup lang="ts">
import { useVehiclesStore } from '~/stores/vehicles'
import { useLinesStore } from '~/stores/lines'

const vehiclesStore = useVehiclesStore()
const linesStore = useLinesStore()

// ── Selected vehicle ──────────────────────────────────────────────────────
const vehicle = computed(() => vehiclesStore.selectedVehicle)

// ── Route colors ──────────────────────────────────────────────────────────
const line = computed(() =>
  linesStore.lines.find(l => l.routeId === vehicle.value?.lineId),
)
const lineColor = computed(() => `#${line.value?.routeColor ?? 'c8102e'}`)
const lineTextColor = computed(() => `#${line.value?.routeTextColor ?? 'ffffff'}`)

// ── Status chip ───────────────────────────────────────────────────────────
const statusLabel = computed(() => ({
  scheduled: 'Théorique',
  estimated: 'Estimé',
  live: 'Temps réel',
})[vehicle.value?.status ?? 'scheduled'])

const statusColor = computed(() => ({
  scheduled: 'grey',
  estimated: 'orange',
  live: 'green',
})[vehicle.value?.status ?? 'scheduled'])

// ── Bearing → 8-point cardinal direction ─────────────────────────────────
const bearingCardinal = computed(() => {
  const b = vehicle.value?.bearing
  if (b === undefined) return ''
  const dirs = ['Nord', 'Nord-Est', 'Est', 'Sud-Est', 'Sud', 'Sud-Ouest', 'Ouest', 'Nord-Ouest']
  return dirs[Math.round(b / 45) % 8] ?? ''
})

// ── Next stop subtitle ────────────────────────────────────────────────────
const nextStopSubtitle = computed(() => {
  const t = vehicle.value?.nextStop?.expectedArrival
  return t ? `Arrivée prévue à ${formatTime(t)}` : 'Prochain arrêt'
})

// ── Delay label ───────────────────────────────────────────────────────────
const delayLabel = computed(() => {
  const delay = vehicle.value?.delaySeconds ?? 0
  if (delay === 0) return 'À l\'heure'
  const minutes = Math.round(Math.abs(delay) / 60)
  return delay > 0
    ? `Retard d'environ ${minutes} min`
    : `En avance d'environ ${minutes} min`
})

// ── Helpers ───────────────────────────────────────────────────────────────
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })
}

function onToggle(open: boolean) {
  if (!open) vehiclesStore.clearSelection()
}
</script>

<template>
  <!--
    Bottom sheet shown when the user taps a vehicle on the map.

    Displays:
    - Line badge (coloured avatar)
    - Destination with a bearing arrow that rotates to show travel direction
    - Status chip (Théorique / Estimé / Temps réel)
    - Next stop + expected arrival
    - Delay readout (hidden when status is "scheduled")
    - Bearing in degrees + cardinal direction
    - Last-updated timestamp
  -->
  <v-bottom-sheet
    :model-value="vehicle !== null"
    inset
    @update:model-value="onToggle"
  >
    <v-card v-if="vehicle" class="glass-surface glass-surface--strong" rounded="t-xl">

      <!-- ── Header ──────────────────────────────────────────────────────── -->
      <v-card-title class="d-flex align-center ga-3">

        <!-- Coloured line badge -->
        <v-avatar :color="lineColor" size="38" rounded="lg">
          <span
            class="font-weight-bold text-caption"
            :style="{ color: lineTextColor }"
          >
            {{ vehicle.lineLabel }}
          </span>
        </v-avatar>

        <!-- Destination + directional arrow -->
        <div class="flex-grow-1 min-width-0">
          <div class="d-flex align-center ga-1">
            <!--
              The navigation icon rotates via CSS to show the vehicle's bearing.
              `transition` in the style block ensures it animates smoothly when
              a new GTFS-RT position snapshot arrives.
            -->
            <v-icon
              v-if="vehicle.bearing !== undefined"
              icon="mdi-navigation"
              size="16"
              class="text-medium-emphasis bearing-arrow"
              :style="{ transform: `rotate(${vehicle.bearing}deg)` }"
              :aria-label="`Cap ${vehicle.bearing}° (${bearingCardinal})`"
            />
            <span class="text-subtitle-1 font-weight-medium text-truncate">
              {{ vehicle.destination }}
            </span>
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ vehicle.mode === 'tram' ? 'Tram' : 'Bus' }} · ligne {{ vehicle.lineLabel }}
          </div>
        </div>

        <!-- Status chip -->
        <v-chip :color="statusColor" size="small" variant="tonal">
          {{ statusLabel }}
        </v-chip>
      </v-card-title>

      <!-- ── Detail rows ─────────────────────────────────────────────────── -->
      <v-card-text class="pt-0">
        <v-list density="compact">

          <!-- Next stop -->
          <v-list-item
            v-if="vehicle.nextStop"
            prepend-icon="mdi-map-marker-outline"
            :title="vehicle.nextStop.name"
            :subtitle="nextStopSubtitle"
          />

          <!-- Delay — only shown when we have live/estimated data -->
          <v-list-item
            v-if="vehicle.delaySeconds !== undefined && vehicle.status !== 'scheduled'"
            prepend-icon="mdi-clock-alert-outline"
            :title="delayLabel"
          />

          <!-- Bearing -->
          <v-list-item
            v-if="vehicle.bearing !== undefined"
            prepend-icon="mdi-compass-outline"
            :title="`Cap ${vehicle.bearing}°`"
            :subtitle="bearingCardinal"
          />

          <!-- Last update -->
          <v-list-item
            prepend-icon="mdi-update"
            :title="`Mis à jour à ${formatTime(vehicle.recordedAt)}`"
          />
        </v-list>
      </v-card-text>
    </v-card>
  </v-bottom-sheet>
</template>


<style scoped>
/*
  The bearing arrow rotates via an inline `transform: rotate(Xdeg)` style.
  This transition ensures the rotation animates smoothly between GTFS-RT
  position snapshots instead of snapping instantly.
*/
.bearing-arrow {
  flex-shrink: 0;
  transition: transform 600ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* Inner list must stay transparent so the glass card shows through */
:deep(.v-list) {
  background: transparent;
}
</style>
