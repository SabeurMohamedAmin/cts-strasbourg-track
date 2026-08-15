<script setup lang="ts">
import type { StopArrival } from '~~/shared/types/stop'
import { formatTime, minutesUntil } from '~/utils/format'

/**
 * "Prochains passages" cards for ONE line + direction.
 * The parent filters the arrivals; this component only displays them.
 *
 * Design cues (matching the home departure cards):
 *   - red left accent bar + red countdown when the vehicle is at the stop
 *   - green wifi icon for live (SIRI) data, muted icon for theoretical times
 *   - the first item is visually the "next" departure (primary emphasis),
 *     the second is the "after next" (secondary emphasis) — this used to be
 *     conveyed only by position, which is invisible to screen readers and
 *     hard to scan at a glance.
 *
 * Countdown format:
 *   - under one hour  → "12" + "min" (imminent, minute precision matters)
 *   - one hour and up → "4h05" (fallback departures can be hours away;
 *     "245 min" would be unreadable)
 *
 * Typography scales with the screen through Vuetify text utility classes
 * (mobile-first, larger from the `sm` breakpoint up).
 */
import { useNow } from '~/composables/useNow'

const props = defineProps<{
  departures: StopArrival[]
  pending?: boolean
}>()

const { now } = useNow()

/**
 * Departures enriched with the countdown. Recomputes when now ticks or when departures change.
 */
const items = computed(() => props.departures.map((departure, index) => {
  const minutes = minutesUntil(departure.scheduledArrival, now.value)
  const isImminent = minutes < 60
  return {
    ...departure,
    rank: index,
    minutes,
    countdown: isImminent ? String(minutes) : `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`,
    countdownUnit: isImminent ? 'min' : '',
    waitLabel: minutes === 0
      ? 'à quai'
      : isImminent
        ? `dans ${minutes} minutes`
        : `passage à ${formatTime(departure.scheduledArrival)}`,
    statusLabel: departure.status === 'live' ? 'temps réel' : 'horaire théorique',
  }
}))
</script>

<template>
  <div class="next-departures"
    role="list"
    aria-label="Prochains passages">
    <div v-if="pending && !items.length"
      class="next-departures__empty text-body-small text-sm-body-medium text-center"
      role="status">
      <v-progress-circular indeterminate
        size="20"
        width="2" />
      Chargement des prochains passages…
    </div>

    <p v-else-if="!items.length"
      class="next-departures__empty text-body-small text-sm-body-medium text-center"
      role="status">
      Aucun passage imminent pour cette direction.
    </p>

    <article v-for="item in items"
      :key="`${item.tripId}-${item.scheduledArrival}`"
      role="listitem"
      class="departure pa-2 px-4"
      :class="[
        { 'departure--now': item.minutes === 0 },
        item.rank === 0 ? 'departure--next' : 'departure--after',
      ]">
      <!-- Rank badge: conveys "next" vs "after next" without relying on
           position or color alone (WCAG 1.4.1). -->
      <div class="departure__rank"
        aria-hidden="true">
        {{ item.rank === 0 ? '1' : '2' }}
      </div>

      <div class="departure__info">
        <span class="text-label-small text-medium-emphasis sr-only">
          {{ item.rank === 0 ? 'Prochain passage' : 'Passage suivant' }}
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
          :class="{ 'text-error': item.minutes === 0 }">{{ item.countdown }}</strong>
        <small v-if="item.countdownUnit"
          class="text-body-small">{{ item.countdownUnit }}</small>
        <span class="sr-only">{{ item.waitLabel }}</span>
      </div>

      <v-icon class="departure__signal"
        :class="item.status === 'live' ? 'departure__signal--live' : 'departure__signal--scheduled'"
        :icon="item.status === 'live' ? 'mdi-access-point' : 'mdi-clock-outline'"
        size="17"
        :aria-label="item.statusLabel" />
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
  border: 1px solid rgba(var(--v-theme-on-surface), .07);
  border-radius: 16px;
  color: rgba(var(--v-theme-on-surface), .6);
  background: rgba(var(--v-theme-surface), .66);
}

/* Screen-reader-only text: visually hidden but announced */
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
  border: 1px solid rgba(var(--v-theme-on-surface), .07);
  border-radius: 16px;
  background: rgba(var(--v-theme-surface), .4);
  box-shadow: 0 8px 24px rgba(0, 0, 0, .08);
  transition: border-color .2s ease, background .2s ease;
}

/* ── Next departure: primary emphasis (matches red arrow) ── */
.departure--next {
  border-color: rgba(var(--v-theme-primary), .2);
}

.departure--next .departure__rank {
  background: rgba(var(--v-theme-primary), .2);
  color: rgba(var(--v-theme-on-primary), .7);
}

/* ── After-next departure: secondary emphasis (matches blue arrow) ── */
.departure--after {
  opacity: .82;
}

.departure--after .departure__rank {
  background: rgba(var(--v-theme-on-surface), .08);
  color: rgba(var(--v-theme-on-surface), .6);
}

/* Red accent bar: the vehicle is arriving right now. Overrides rank tint. */
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
}

.departure__info {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.departure__info small {
  color: rgba(var(--v-theme-on-surface), .5);
}

.departure__countdown {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-variant-numeric: tabular-nums;
}

.departure__countdown small {
  color: rgba(var(--v-theme-on-surface), .5);
}

.departure__signal--live {
  color: #4caf50;
}

.departure__signal--scheduled {
  color: rgba(var(--v-theme-on-surface), .38);
}

@media (prefers-reduced-motion: reduce) {
  .departure {
    transition: none;
  }
}
</style>