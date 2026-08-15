<script setup lang="ts">
import SwapDirectionIcon from '~/components/ui/SwapDirectionIcon.vue'
import { useNow } from '~/composables/useNow'
import { minutesUntil } from '~/utils/format'

export interface Departure {
  mode: 'tram' | 'bus'
  line: string
  badgeColor: string
  stopName?: string
  destination: string
  hint?: string
  nextMin: number
  thenMin?: number
  oppositeDestination?: string
  oppositeNextMin?: number
  oppositeThenMin?: number
  nextIso?: string
  thenIso?: string
  oppositeNextIso?: string
  oppositeThenIso?: string
  crowd: 1 | 2 | 3 | 4 | 5
  accessible?: boolean
  touristPin?: boolean
  night?: boolean
}
type Direction = {
  type: 'destination' | 'opposite'
  destination: string
  nextMin: number
  thenMin?: number
}

const props = defineProps<{ departure: Departure }>()
const { now } = useNow()

const mode = computed(() => props.departure.mode === 'tram'
  ? { label: 'Tram', icon: 'mdi-tram' }
  : { label: 'Bus', icon: 'mdi-bus' })
const crowdLabel = computed(() => ({ 1: 'Calme', 2: 'Places disponibles', 3: 'Affluence moyenne', 4: 'Peu de places', 5: 'Très chargé' })[props.departure.crowd])

/** Live countdown from an ISO timestamp, or the static fallback when absent. */
function calcMin(iso?: string, fallback = 0): number {
  return iso ? minutesUntil(iso, now.value) : fallback
}

function calcOptMin(iso?: string, fallback?: number): number | undefined {
  return iso ? minutesUntil(iso, now.value) : fallback
}

const directions = computed((): Direction[] => {
  const items: Direction[] = [
    {
      type: 'destination',
      destination: props.departure.destination,
      nextMin: calcMin(props.departure.nextIso, props.departure.nextMin),
      thenMin: calcOptMin(props.departure.thenIso, props.departure.thenMin),
    },
  ]

  if (
    props.departure.oppositeDestination &&
    (props.departure.oppositeNextIso || props.departure.oppositeNextMin != null)
  ) {
    items.push({
      type: 'opposite',
      destination: props.departure.oppositeDestination,
      nextMin: calcMin(props.departure.oppositeNextIso, props.departure.oppositeNextMin ?? 0),
      thenMin: calcOptMin(props.departure.oppositeThenIso, props.departure.oppositeThenMin),
    })
  }

  return items
})

function formatMinutes(minutes: number) { return minutes === 0 ? 'À quai' : `${minutes} min` }

const accessibleLabel = computed(() => `${mode.value.label} ${props.departure.line}. ${directions.value.map(direction => `Direction ${direction.destination}, ${formatMinutes(direction.nextMin)}`).join('. ')}. ${crowdLabel.value}.`)
</script>

<template>
  <article class="departure-card" :style="{ '--line-color': departure.badgeColor }" :aria-label="accessibleLabel">
    <div class="route-identity" aria-hidden="true">
      <span class="route-badge">
        {{ departure.line }}
      </span>
      <span class="route-mode">
        <v-icon :icon="mode.icon" size="13"/>
        {{ mode.label }}
      </span>
    </div>

    <div class="departure-body">
      <div class="directions" aria-hidden="true">
        <div v-for="direction in directions" :key="direction.destination" class="direction mb-2">
          <div class="destination ">
            <small>Direction</small>
            <div class="d-flex align-center">
              <!--
                Shared direction glyph (same as the station page toggle):
                outbound lights the right arrow, return the left one. The
                highlighted arrow takes the line's brand color.
              -->
              <SwapDirectionIcon
                :direction="direction.type === 'destination' ? 'right' : 'left'"
                :size="20"
                active-color="var(--line-color)"
                inactive-color="rgba(var(--v-theme-on-surface), .3)"
                class="direction__icon me-3 disabled"
              />
              <strong class="text-label-small text-sm-label-large">
                {{ direction.destination }}
              </strong>
            </div>
          </div>
          <div class="minutes" :class="{ 'minutes--urgent': direction.nextMin <= 3 }">
            <strong>
              {{ formatMinutes(direction.nextMin) }}
            </strong>
            <small v-if="direction.thenMin != null">
              puis dans {{ direction.thenMin }} min
            </small>
          </div>
        </div>
      </div>
      <div class="metadata" aria-hidden="true">
        <span>
          <v-icon icon="mdi-account-group-outline" size="14" />
          {{ crowdLabel }}
        </span>
        <span v-if="departure.accessible">
          <v-icon icon="mdi-wheelchair-accessibility" size="14" />
          Accessible
        </span>

        <span v-if="departure.night">
          <v-icon icon="mdi-weather-night" size="14" />
          Nocturne
        </span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.departure-card {
  position: relative;
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  gap: 15px;
  padding: 15px 16px 14px 18px;
  overflow: hidden;
  border: 1px solid rgba(var(--v-theme-on-surface), .07);
  border-radius: 16px;
  color: rgba(var(--v-theme-on-surface), .94);
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 8px 24px rgba(0, 0, 0, .08);
}
.departure-card::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--line-color);
  content: ''; 
}
.route-identity {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding-top: 2px;
}
.route-badge { display: grid; width: 52px; height: 52px; place-items: center; border-radius: 14px; color: #fff; background: var(--line-color); font-size: 1.18rem; font-weight: 900; box-shadow: 0 5px 16px color-mix(in srgb, var(--line-color) 22%, transparent); }
.route-mode { display: flex; align-items: center; gap: 3px; color: rgba(var(--v-theme-on-surface), .5); font-size: .62rem; font-weight: 700; text-transform: uppercase; }
.departure-body { min-width: 0; }
.directions { display: grid; }
.direction {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto; 
  align-items: center;
  gap: 12px; 
  min-height: 48px;
}
.direction + .direction { 
  border-top: 1px solid rgba(var(--v-theme-on-surface), .07);
} 
.direction:last-child{
  margin-bottom:0;
  padding-top: 4px;
}
.destination { 
  min-width: 0;
 }
.destination small { 
  display: block; 
  margin-bottom: 1px; 
  color: rgba(var(--v-theme-on-surface), .44); 
  font-size: .61rem; 
  font-weight: 700; 
  letter-spacing: .06em; 
  text-transform: uppercase; 
}
.destination strong { 
  display: block; 
  overflow: hidden; 
  font-weight: 760; 
  line-height: 1.25; 
  text-overflow: ellipsis; 
  white-space: nowrap; 
}
/* Framed like the former v-icon (border + padding), sized content-box so the
   18px glyph keeps its optical size inside the frame. */
.direction__icon {
  box-sizing: content-box;
  flex: 0 0 auto;
  padding: 5px;
  border: 1px solid rgba(var(--v-theme-on-surface), .12);
  border-radius: 8px;
}
.minutes { display: flex; min-width: 68px; flex-direction: column; align-items: flex-end; font-variant-numeric: tabular-nums; }
.minutes strong { color: rgba(var(--v-theme-on-surface), .94); font-size: 1.14rem; font-weight: 900; letter-spacing: -.04em; }
.minutes--urgent strong { color: #ff6f61; }
.minutes small { color: rgba(var(--v-theme-on-surface), .48); font-size: .61rem; }
.metadata { display: flex; flex-wrap: wrap; gap: 6px 12px; margin-top: 8px; padding-top: 9px; border-top: 1px solid rgba(var(--v-theme-on-surface), .07); }
.metadata span { display: inline-flex; align-items: center; gap: 4px; color: rgba(var(--v-theme-on-surface), .58); font-size: .66rem; }
@media (max-width: 380px) {
  .departure-card {
    grid-template-columns: 26px minmax(0, 1fr);
    gap: 10px;
    padding-inline: 14px 11px;
    .route-badge {
      display: grid;
      width: 38px;
      height: 38px;
      place-items: center;
      border-radius: 8px;
      color: #fff;
      background: var(--line-color);
      font-size: 1.1rem;
      font-weight: 900;
      box-shadow: 0 5px 16px color-mix(in srgb, var(--line-color) 22%, transparent);
    }
    .route-mode {
      display: flex;
      align-items: center;
      gap: 2px;
      color: rgba(var(--v-theme-on-surface), .5);
      font-size: .48rem;
      font-weight: 700;
      text-transform: uppercase;
    }
  }
  .route-badge { width: 46px; height: 46px; } }
@media (forced-colors: active) { .departure-card, .route-badge { border: 1px solid CanvasText; } }
</style>