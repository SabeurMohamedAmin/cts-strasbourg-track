<script setup lang="ts">
import { computed } from 'vue'
import type { StopArrival } from '~~/shared/types/stop'
import { formatTime, minutesUntil } from '~/utils/format'
import { useNow } from '~/composables/useNow'

/**
 * "Prochains passages" cards for ONE line + direction.
 * The parent filters the arrivals; this component only displays them.
 */
const props = withDefaults(
  defineProps<{
    departures: StopArrival[]
    pending?: boolean
  }>(),
  {
    pending: false,
    departures: () => [],
  }
)

const { now } = useNow()

/**
 * Departures enriched with the countdown. Recomputes when now ticks or departures change.
 */
const items = computed(() =>
  props.departures.map((departure, index) => {
    const rawMinutes = minutesUntil(departure.scheduledArrival, now.value)
    // Prevent negative numbers if a departure is past scheduled time but still displayed
    const minutes = Math.max(0, rawMinutes)
    const isImminent = minutes < 60

    let waitLabel = 'à quai'
    if (minutes > 0) {
      waitLabel = isImminent
        ? `dans ${minutes} minute${minutes > 1 ? 's' : ''}`
        : `passage à ${formatTime(departure.scheduledArrival)}`
    }

    return {
      ...departure,
      rank: index,
      minutes,
      countdown: isImminent
        ? String(minutes)
        : `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`,
      countdownUnit: isImminent ? 'min' : '',
      waitLabel,
      statusLabel: departure.status === 'live' ? 'temps réel' : 'horaire théorique',
    }
  })
)
</script>

<template>
  <div class="next-departures"
    role="list"
    aria-label="Prochains passages">
    <!-- Loading State -->
    <div v-if="pending && !items.length"
      class="next-departures__empty text-body-small text-sm-body-medium text-center"
      role="status">
      <v-progress-circular indeterminate
        size="20"
        width="2" />
      <span>Chargement des prochains passages…</span>
    </div>

    <!-- Empty State -->
    <p v-else-if="!items.length"
      class="next-departures__empty text-body-small text-sm-body-medium text-center"
      role="status">
      Aucun passage imminent pour cette direction.
    </p>

    <!-- Departure Cards -->
    <article v-for="item in items"
      :key="`${item.tripId}-${item.scheduledArrival}`"
      role="listitem"
      class="departure pa-2 px-4"
      :class="[
        { 'departure--now': item.minutes === 0 },
        item.rank === 0 ? 'departure--next' : 'departure--after',
      ]">
      <!-- Rank badge (WCAG 1.4.1) -->
      <div class="departure__rank"
        aria-hidden="true">
        {{ item.rank + 1 }}
      </div>

      <div class="departure__info">
        <span class="sr-only">
          {{ item.rank === 0 ? 'Prochain passage' : `Passage n°${item.rank + 1}` }}
        </span>
        <strong class="text-body-medium text-sm-body-large font-weight-bold text-truncate">
          {{ item.destination }}
        </strong>
        <small class="text-body-small">
          {{ item.minutes === 0 ? 'À quai' : `Passage à ${formatTime(item.scheduledArrival)}` }}
        </small>
      </div>

      <div class="departure__countdown">
        <strong class="text-headline-small text-sm-headline-medium font-weight-black"
          :class="{ 'text-error': item.minutes === 0 }">
          {{ item.countdown }}
        </strong>
        <small v-if="item.countdownUnit"
          class="text-body-small">
          {{ item.countdownUnit }}
        </small>
        <span class="sr-only">{{ item.waitLabel }}</span>
      </div>

      <div class="departure__status">
        <v-icon class="departure__signal"
          :class="item.status === 'live' ? 'departure__signal--live' : 'departure__signal--scheduled'"
          :icon="item.status === 'live' ? 'mdi-access-point' : 'mdi-clock-outline'"
          size="17"
          aria-hidden="true" />
        <span class="sr-only">{{ item.statusLabel }}</span>
      </div>
    </article>
  </div>
</template>

<style scoped>
.next-departures {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.next-departures__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 72px;
  padding: 16px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.07);
  border-radius: 16px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  background: rgba(var(--v-theme-surface), 0.66);
}

/* Visually hidden utility */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.departure {
  position: relative;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto 24px;
  align-items: center;
  gap: 12px;
  overflow: hidden;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.07);
  border-radius: 16px;
  background: rgba(var(--v-theme-surface), 0.4);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  transition: border-color 0.2s ease, background 0.2s ease;
}

/* Next departure: primary emphasis */
.departure--next {
  border-color: rgba(var(--v-theme-primary), 0.2);
}

.departure--next .departure__rank {
  background: rgba(var(--v-theme-primary), 0.2);
  color: rgba(var(--v-theme-on-primary), 0.7);
}

/* After-next departure: secondary emphasis */
.departure--after {
  opacity: 0.82;
}

.departure--after .departure__rank {
  background: rgba(var(--v-theme-on-surface), 0.08);
  color: rgba(var(--v-theme-on-surface), 0.6);
}

/* Vehicle arriving right now */
.departure--now::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: rgb(var(--v-theme-error));
  content: '';
}

.departure__rank {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.departure__info {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.departure__info small {
  color: rgba(var(--v-theme-on-surface), 0.5);
}

.departure__countdown {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-variant-numeric: tabular-nums;
}

.departure__countdown small {
  color: rgba(var(--v-theme-on-surface), 0.5);
}

.departure__status {
  display: flex;
  align-items: center;
  justify-content: center;
}

.departure__signal--live {
  color: #4caf50;
}

.departure__signal--scheduled {
  color: rgba(var(--v-theme-on-surface), 0.38);
}

@media (prefers-reduced-motion: reduce) {
  .departure {
    transition: none;
  }
}
</style>