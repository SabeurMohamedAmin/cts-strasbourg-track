<script setup lang="ts">
import type { ScheduleHourRow } from '~~/shared/types/schedule'

/**
 * Hour-by-hour theoretical timetable (24h day view).
 * One row per hour: fixed-width hour label + wrapping minute list.
 * The row matching `currentHour` is highlighted (red bar + red tint).
 *
 * Typography scales with the screen through Vuetify text utility classes
 * (mobile-first, larger from the `sm` breakpoint up).
 */
const props = defineProps<{
  hours: ScheduleHourRow[]
  /** Current hour (0-23) in Europe/Paris, provided by the page. */
  currentHour: number
}>()

const rows = computed(() => props.hours.map(row => ({
  key: row.hour,
  // GTFS hours ≥ 24 are after-midnight trips: display "00h", "01h"…
  label: `${String(row.hour % 24).padStart(2, '0')}h`,
  minutes: row.minutes.map(minute => String(minute).padStart(2, '0')),
  isCurrent: row.hour % 24 === props.currentHour,
})))
</script>

<template>
  <div class="timetable">
    <p v-if="!rows.length" class="timetable__empty text-body-small text-sm-body-medium text-center" role="status">
      Aucun passage théorique aujourd'hui pour cette direction.
    </p>
    <div
      v-for="row in rows"
      :key="row.key"
      class="timetable__row"
      :class="{ 'timetable__row--current': row.isCurrent }"
      :aria-current="row.isCurrent ? 'time' : undefined"
    >
      <span class="timetable__hour text-label-large text-sm-title-small font-weight-bold border-e-md">
        {{ row.label }}
      </span>
      <span class="timetable__minutes text-body-medium text-sm-body-large">
        <span
          v-for="(minute, index) in row.minutes"
          :key="`${row.key}-${index}`"
          class="timetable__minute font-weight-semibold"
        >{{ minute }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.timetable {
  overflow: hidden;
  border: 1px solid rgba(var(--v-theme-on-surface), .07);
  border-radius: 16px;
  background: rgba(var(--v-theme-surface), .66);
}
.timetable__empty {
  padding: 20px 16px;
  color: rgba(var(--v-theme-on-surface), .55);
}
.timetable__row {
  display: grid;
  grid-template-columns: 50px minmax(0, 1fr);
  gap: 12px;
  align-items: baseline;
  padding: 13px 14px;
  border-left: 3px solid transparent;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), .05);
}
.timetable__row:last-child { border-bottom: 0; }
.timetable__row--current {
  border-left-color: rgb(var(--v-theme-error));
  background: rgba(var(--v-theme-error), .07);
}
.timetable__hour {
  color: rgba(var(--v-theme-on-surface), .8);
  font-variant-numeric: tabular-nums;
}
.timetable__row--current .timetable__hour { color: rgb(var(--v-theme-error)); }
.timetable__minutes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
}
.timetable__minute {
  color: rgba(var(--v-theme-on-surface), .88);
  font-variant-numeric: tabular-nums;
}
</style>
