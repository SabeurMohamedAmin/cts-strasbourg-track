<script setup lang="ts">
interface StopOnRoute {
  name: string
  slug?: string
  isCurrent?: boolean
}

const props = defineProps<{
  stops: StopOnRoute[]
}>()

const LABEL_ROTATION = -35 // degrees — recommended from your design system

const barRef = ref<HTMLElement | null>(null)

function scrollToCurrent(behavior: ScrollBehavior = 'smooth') {
  nextTick(() => {
    const el = barRef.value?.querySelector<HTMLElement>('.stop--current')
    el?.scrollIntoView({ behavior, block: 'nearest', inline: 'center' })
  })
}

// Scroll the current stop into the center of the bar on mount
onMounted(() => {
  scrollToCurrent('instant')
})

watch(() => props.stops, () => {
  scrollToCurrent('smooth')
})
</script>

<template>
  <div class="route-bar-wrapper" role="navigation" aria-label="Arrêts de la ligne">
    <!-- Left scroll button -->
    <v-btn
      icon
      variant="tonal"
      density="compact"
      size="small"
      class="route-bar__arrow route-bar__arrow--left"
      aria-label="Précédent"
      @click="barRef!.scrollBy({ left: -160, behavior: 'smooth' })"
    >
      <v-icon icon="mdi-chevron-left" size="18" />
    </v-btn>

    <!-- Scrollable track -->
    <div ref="barRef" class="route-bar__track">
      <div class="route-bar__line" aria-hidden="true" />

      <NuxtLink
        v-for="(stop, i) in stops"
        :key="i"
        :to="stop.slug ? `/station/${stop.slug}` : undefined"
        class="stop"
        :class="{ 'stop--current': stop.isCurrent, 'stop--link': !!stop.slug }"
        :aria-current="stop.isCurrent ? 'location' : undefined"
      >
        <!-- Dot -->
        <span class="stop__dot" />
        <!-- Label rotated at -35° -->
        <span
          class="stop__label"
          :style="{ '--rot': `${LABEL_ROTATION}deg` }"
        >
          {{ stop.name }}
        </span>
      </NuxtLink>
    </div>

    <!-- Right scroll button -->
    <v-btn
      icon
      variant="tonal"
      density="compact"
      size="small"
      class="route-bar__arrow route-bar__arrow--right"
      aria-label="Suivant"
      @click="barRef!.scrollBy({ left: 160, behavior: 'smooth' })"
    >
      <v-icon icon="mdi-chevron-right" size="18" />
    </v-btn>
  </div>
</template>

<style scoped>
/* ── Wrapper ──────────────────────────────────────────── */
.route-bar-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
}

/* ── Scrollable track ─────────────────────────────────── */
.route-bar__track {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0;
  flex: 1;
  overflow-x: auto;
  overflow-y: visible;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
  /* Reserve 64px vertical space at top for -35° rotated labels so overflow-x doesn't clip them */
  padding: 64px 8px 12px 8px;
}
.route-bar__track::-webkit-scrollbar { display: none; }

/* Horizontal connecting line */
.route-bar__line {
  position: absolute;
  top: calc(64px + 5px);
  left: 8px;
  right: 8px;
  height: 2px;
  background: rgba(var(--v-theme-on-surface), .2);
  transform: translateY(-50%);
  pointer-events: none;
  z-index: 0;
}

/* ── Individual stop ──────────────────────────────────── */
.stop {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  /* Fixed pitch between stops — adjust to taste */
  width: 72px;
  text-decoration: none;
  color: inherit;
  z-index: 1;
  scroll-snap-align: center;
}

/* Dot */
.stop__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(var(--v-theme-on-surface), .45);
  border: 2px solid rgb(var(--v-theme-surface));
  transition: background 0.2s, transform 0.2s;
  flex-shrink: 0;
}

/* Current stop — bigger, coloured dot */
.stop--current .stop__dot {
  width: 14px;
  height: 14px;
  background: rgb(var(--v-theme-error));
  border-color: rgb(var(--v-theme-error));
  box-shadow: 0 0 0 4px rgba(var(--v-theme-error), .25);
}

/* Link hover effect */
.stop--link:hover .stop__dot {
  background: rgb(var(--v-theme-primary));
  transform: scale(1.25);
}

/* ── Rotated label ────────────────────────────────────── */
.stop__label {
  position: absolute;
  /* Place the label's bottom-right corner at the dot center */
  bottom: calc(100% + 6px);
  left: 50%;
  transform-origin: bottom left;
  transform: rotate(var(--rot, -35deg));
  white-space: nowrap;

  font-size: 11px;
  line-height: 1.2;
  color: rgba(var(--v-theme-on-surface), .7);
  pointer-events: none;

  /* Truncate very long names */
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stop--current .stop__label {
  color: rgb(var(--v-theme-error));
  font-weight: 600;
}

.stop--link:hover .stop__label {
  color: rgb(var(--v-theme-primary));
}

/* ── Arrow buttons ───────────────────────────────────── */
.route-bar__arrow {
  flex-shrink: 0;
  opacity: 0.7;
}
.route-bar__arrow:hover { opacity: 1; }
</style>
