<!--
  FavoriteGroupsPanel (Step 3.3)

  The « Favoris » section of the app drawer: header with total count,
  empty state, collapsible groups and their stops. Store access stays in
  the parent — groups arrive pre-resolved (color hex + stop names).

  Rows are Vuetify v-list-item (shared styles, ripple, keyboard support);
  the scoped CSS compacts them to drawer proportions and adds what Vuetify
  cannot express: color dot, group rail, chevron rotation, hover arrow.

  Dumb component contract:
    props:  groups      — view models: id, name, colorHex, collapsed, stops
            total-count — total number of favourite stops across groups
    emits:  toggle-collapse(groupId)
            select(stopId)

  Accessibility notes:
    - Group headers expose aria-expanded + aria-controls, so screen
      readers announce the collapsed state.
    - Group content stays in the DOM (v-show) so aria-controls always
      points to an existing element.
    - The color dot, rail and icons are decorative (aria-hidden); counts
      carry explicit labels.
-->
<script setup lang="ts">
/** Pre-resolved group view model — no store types leak in here. */
interface FavoriteGroupView {
  id: string
  name: string
  colorHex: string
  collapsed: boolean
  stops: { id: string, name: string }[]
}

defineProps<{
  groups: FavoriteGroupView[]
  totalCount: number
}>()

const emit = defineEmits<{
  'toggle-collapse': [groupId: string]
  'select': [stopId: string]
}>()

/** "3 arrêts favoris" / "1 arrêt favori" — for count aria-labels. */
function favCountLabel(count: number): string {
  return `${count} arrêt${count > 1 ? 's' : ''} favori${count > 1 ? 's' : ''}`
}
</script>

<template>
  <section class="fav-panel d-flex flex-column" aria-labelledby="fav-panel-title">
    <header class="d-flex align-center justify-space-between px-4 pt-3 pb-1">
      <h2 id="fav-panel-title" class="fav-panel__title text-overline d-inline-flex align-center ga-1">
        <v-icon icon="mdi-star" size="15" color="primary" aria-hidden="true" />
        Favoris
      </h2>
      <v-chip
        v-if="totalCount > 0"
        class="fav-pill fav-pill--primary"
        size="x-small"
        color="primary"
        variant="tonal"
        :aria-label="favCountLabel(totalCount)"
      >
        {{ totalCount }}
      </v-chip>
    </header>

    <!-- Empty favourites: friendly onboarding hint. -->
    <div
      v-if="totalCount === 0"
      class="fav-empty d-flex flex-column align-center text-center mx-3 mb-2 pa-4 rounded-xl"
    >
      <span class="fav-empty__icon mb-2" aria-hidden="true">
        <v-icon icon="mdi-star-outline" size="22" />
      </span>
      <p class="text-caption font-weight-bold">Aucun arrêt favori</p>
      <p class="fav-empty__hint text-caption">Appuyez sur ★ sur un arrêt pour le retrouver ici.</p>
    </div>

    <!-- Scrollable groups area — the drawer footer stays pinned below. -->
    <v-list class="fav-panel__scroll bg-transparent py-0 px-2" density="compact">
      <template v-for="group in groups" :key="group.id">
        <v-list-item
          class="fav-group__header rounded-lg"
          density="compact"
          :aria-expanded="!group.collapsed"
          :aria-controls="`fav-group-${group.id}`"
          @click="emit('toggle-collapse', group.id)"
        >
          <template #prepend>
            <span
              class="fav-group__dot"
              :style="{ background: group.colorHex }"
              aria-hidden="true"
            />
          </template>

          <v-list-item-title class="fav-group__name font-weight-medium">
            {{ group.name }}
          </v-list-item-title>

          <template #append>
            <v-chip
              class="fav-pill fav-pill--muted"
              size="x-small"
              variant="flat"
              :aria-label="favCountLabel(group.stops.length)"
            >
              {{ group.stops.length }}
            </v-chip>
            <v-icon
              class="fav-group__chevron ml-1"
              icon="mdi-chevron-down"
              size="18"
              aria-hidden="true"
            />
          </template>
        </v-list-item>

        <v-expand-transition>
          <!-- v-show (not v-if) keeps the element referenced by
               aria-controls in the DOM even while collapsed. -->
          <div v-show="!group.collapsed" :id="`fav-group-${group.id}`">
            <!-- The rail inherits the group color, visually nesting the
                 stops under their group header. -->
            <div class="fav-group__content mb-1 ps-1" :style="{ '--group-color': group.colorHex }">
              <p v-if="!group.stops.length" class="fav-group__empty text-caption font-italic py-1 pl-3">
                Aucun arrêt dans ce groupe.
              </p>
              <v-list-item
                v-for="stop in group.stops"
                :key="stop.id"
                class="fav-stop rounded-lg"
                density="compact"
                :aria-label="`Afficher l’arrêt ${stop.name}`"
                @click="emit('select', stop.id)"
              >
                <template #prepend>
                  <v-icon
                    class="fav-stop__marker"
                    icon="mdi-map-marker"
                    size="15"
                    aria-hidden="true"
                  />
                </template>

                <v-list-item-title class="fav-stop__name">{{ stop.name }}</v-list-item-title>

                <template #append>
                  <v-icon class="fav-stop__arrow" icon="mdi-chevron-right" size="15" aria-hidden="true" />
                </template>
              </v-list-item>
            </div>
          </div>
        </v-expand-transition>
      </template>
    </v-list>
  </section>
</template>

<style scoped>
/*
  Same design language as .drawer-navigation in AppDrawer: 12px rounded
  rows, soft on-surface tints, primary accents — all theme tokens so the
  panel adapts to light and dark modes automatically.
*/
.fav-panel {
  flex: 1 1 auto;
  min-height: 0;
}

.fav-panel__title {
  color: rgba(var(--v-theme-on-surface), 0.62);
  line-height: 1;
}

/* Scrolls independently; the drawer footer stays pinned at the bottom via
   the Vuetify `#append` slot (flex-shrink: 0 internally). */
.fav-panel__scroll {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--v-theme-on-surface), 0.25) transparent;
}

/* ── Count pills ──
   Vuetify's x-small chip is still tall for a drawer row: compact it into
   the pill shape of the original design. */
.fav-pill {
  height: 18px;
  padding-inline: 6px;
  font-size: 0.65rem;
  font-weight: 800;
}
.fav-pill--muted {
  background: rgba(var(--v-theme-on-surface), 0.08) !important;
  color: rgba(var(--v-theme-on-surface), 0.65) !important;
}

/* ── Empty state ── */
.fav-empty {
  border: 1px dashed rgba(var(--v-theme-on-surface), 0.18);
}
.fav-empty__icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 13px;
  background: rgba(var(--v-theme-primary), 0.08);
  color: rgb(var(--v-theme-primary));
}
.fav-empty__hint {
  color: rgba(var(--v-theme-on-surface), 0.55);
}

/* ── Compact Vuetify list rows to drawer proportions ──
   The default prepend spacer (32px) pushed the dot far from the name. */
.fav-group__header :deep(.v-list-item__spacer),
.fav-stop :deep(.v-list-item__spacer) {
  width: 10px;
}
.fav-group__header {
  min-height: 42px;
  padding-inline: 10px;
}

.fav-group__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgba(var(--v-theme-on-surface), 0.06);
}

.fav-group__name {
  font-size: 0.85rem;
  color: rgba(var(--v-theme-on-surface), 0.88);
}

/* Chevron flips when the group is expanded — aria-expanded doubles as the
   styling hook, so visual state can never drift from the announced state. */
.fav-group__chevron {
  color: rgba(var(--v-theme-on-surface), 0.45);
  transition: transform 0.2s ease;
}
.fav-group__header[aria-expanded='true'] .fav-group__chevron {
  transform: rotate(180deg);
}

/* ── Group content: rail tinted with the group color ── */
.fav-group__content {
  margin-left: 5px; /* aligns the rail under the header dot */
  border-left: 1px dashed color-mix(in srgb, var(--group-color) 10%, transparent);
}

.fav-group__empty {
  color: rgba(var(--v-theme-on-surface), 0.45);
}

/* ── Stop rows ── */
.fav-stop {
  min-height: 38px;
  padding-inline: 5px;
}
.fav-stop__marker {
  color: var(--group-color);
  opacity: 0.9;
}
.fav-stop__name {
  font-size: 0.82rem;
  color: rgba(var(--v-theme-on-surface), 0.78);
}
.fav-stop:hover .fav-stop__name {
  color: rgb(var(--v-theme-on-surface));
}

.fav-stop__arrow {
  color: rgba(var(--v-theme-on-surface), 0.4);
  opacity: 0;
  transform: translateX(-3px);
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fav-stop:hover .fav-stop__arrow {
  opacity: 1;
  transform: translateX(0);
}

/* ── Focus & motion ── */
.fav-group__header:focus-visible,
.fav-stop:focus-visible {
  outline: 3px solid rgb(var(--v-theme-primary));
  outline-offset: -1px;
}

@media (prefers-reduced-motion: reduce) {
  .fav-group__chevron,
  .fav-stop__arrow {
    transition: none;
  }
}
</style>
