<script setup lang="ts">
  import { useFavoriteGroupsStore, GROUP_COLORS, type GroupColor } from '~/stores/favoriteGroups'
  import { useStopsStore } from '~/stores/stops'
  import FavoriteGroupsPanel from '~/components/ui/FavoriteGroupsPanel.vue'
  import ConnectionStatusChip from '~/components/ui/ConnectionStatusChip.vue'

  defineProps<{
    modelValue: boolean
    isDark: boolean
  }>()

  const emit = defineEmits<{
    'update:modelValue': [open: boolean]
    'toggle-theme': []
  }>()

  const stopsStore = useStopsStore()
  const favStore = useFavoriteGroupsStore()

  const navigationItems = [
    { label: 'Horaires', icon: 'mdi-clock-outline', to: '/', exact: true },
    { label: 'Favoris', icon: 'mdi-star-outline', to: '/favoris' },
    { label: 'Plans', icon: 'mdi-map-outline', to: '/plans' },
    { label: 'Trajet', icon: 'mdi-map-marker-path', to: '/trajet' },
    { label: 'Live', icon: 'mdi-access-point', to: '/live', isLive: true },
  ]

  // Info pages shown in the collapsible "Autres pages" panel
  // pinned at the bottom of the drawer.
  const infoPages = [
    { label: 'À propos', icon: 'mdi-information-outline', to: '/a-propos' },
    { label: 'Contact', icon: 'mdi-email-outline', to: '/contact' },
    { label: 'Confidentialité', icon: 'mdi-shield-lock-outline', to: '/confidentialite' },
    { label: 'Conditions d’utilisation', icon: 'mdi-file-document-outline', to: '/conditions-utilisation' },
    { label: 'Mentions légales', icon: 'mdi-scale-balance', to: '/mentions-legales' },
  ]

  onMounted(favStore.hydrate)

  /**
   * Opening a favourite behaves like tapping a landmark card on the home
   * page: navigate to `/?lat&lon&place` with the stop's own coordinates.
   * The home route watcher (the single fetch entry point) then loads the
   * ~10 nearest stations — the clicked stop comes first with distance 0 m
   * and its departures render right below. Encoding the position in the
   * URL keeps the result shareable and survives a page refresh.
   */
  async function selectStop(stopId: string) {
    // Close the drawer on every viewport, like the navigation links do,
    // so the results are immediately visible.
    emit('update:modelValue', false)

    if (!stopsStore.stops.length) await stopsStore.fetchStops()
    const stop = stopsStore.stopsById.get(stopId)

    // Coordinates unavailable (stale favourite after a GTFS import):
    // fall back to the previous behaviour and select the stop on the map.
    if (!stop) {
      stopsStore.selectStop(stopId)
      return
    }

    await navigateTo({
      path: '/',
      query: {
        lat: String(stop.stopLat),
        lon: String(stop.stopLon),
        place: stop.stopName,
        // Asks the home page to scroll the results section into view.
        results: 'nearby',
      },
    })
  }

  const totalFavCount = computed(() =>
    favStore.groups.reduce((total, group) => total + group.stopIds.length, 0),
  )

  function stopName(stopId: string) {
    return stopsStore.stops.find(stop => stop.stopId === stopId)?.stopName ?? stopId
  }

  function groupColorHex(color: GroupColor): string {
    return GROUP_COLORS.find(option => option.key === color)?.hex ?? '#757575'
  }

  const panelGroups = computed(() => favStore.groups.map(group => ({
    id: group.id,
    name: group.name,
    colorHex: groupColorHex(group.color),
    collapsed: group.collapsed,
    stops: group.stopIds.map(stopId => ({ id: stopId, name: stopName(stopId) })),
  })))

  function createGroup(name: string) {
    favStore.createGroup(name, 'blue')
  }
</script>

<template>
  <v-navigation-drawer
    class="glass-surface glass-surface--strong"
    :model-value="modelValue"
    temporary
    :width="300"
    style="top: 0"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <header class="drawer-header rounded-lg ma-0 mx-1 my-2 py-1 px-2">
      <div class="drawer-header__top">
        <NuxtLink
          to="/"
          class="drawer-home-link"
          aria-label="Retourner à l’accueil Strasbourg Bus-Trams Live"
          @click="emit('update:modelValue', false)"
        >
          <span class="rounded-lg pa-0 ma-0" aria-hidden="true">
            <v-avatar image="/Document.png" class="drawer-brand-mark rounded-lg pa-0 ma-0" size="42" />
          </span>
          <span class="drawer-brand-copy">
            <span class="drawer-brand-name">Bus-Trams Live</span>
            <span class="drawer-brand-caption">Strasbourg · Mobilité en temps réel</span>
          </span>
        </NuxtLink>

        <v-btn
          icon="mdi-close"
          variant="plain"
          size="x-small"
          rounded="lg"
          class="cursor-pointer"
          aria-label="Fermer le menu"
          @click="emit('update:modelValue', false)"
        />
      </div>

      <div class="drawer-header__status rounded-lg py-1 mt-2 d-flex align-center justify-space-between" aria-label="État et préférences">
        <ConnectionStatusChip variant="chip"  />
        <v-btn
          :icon="isDark ? 'mdi-white-balance-sunny' : 'mdi-moon-waning-crescent'"
          variant="plain"
          size="x-small"
          class="icon-dark-mode cursor-pointer text-body-small"
          :class="{ 'icon-dark-mode--moon': !isDark }"
          :aria-label="isDark ? 'Activer le mode clair' : 'Activer le mode sombre'"
          @click="emit('toggle-theme')"
        />
      </div>
    </header>

    <v-divider />

    <nav class="drawer-navigation" aria-label="Navigation principale">
      <NuxtLink
        v-for="item in navigationItems"
        :key="item.to"
        :to="item.to"
        class="drawer-navigation__link"
        active-class="drawer-navigation__link--active"
        :exact="item.exact"
        @click="emit('update:modelValue', false)"
      >
        <span class="drawer-navigation__icon" aria-hidden="true">
          <v-icon :icon="item.icon" size="21" />
          <span v-if="item.isLive" class="drawer-navigation__live-dot" />
        </span>
        <span>{{ item.label }}</span>
      </NuxtLink>
    </nav>

    <v-divider />

    <FavoriteGroupsPanel
      :groups="panelGroups"
      :total-count="totalFavCount"
      @toggle-collapse="favStore.toggleCollapse"
      @remove-stop="favStore.removeStop"
      @create-group="createGroup"
      @select="selectStop"
    />

    <!-- Blog: pinned between the favorites and the "Autres pages" panel
         so it is easy to find. -->
    <v-divider />
    <nav class="drawer-navigation drawer-navigation--compact" aria-label="Blog">
      <NuxtLink
        to="/blog"
        class="drawer-navigation__link"
        active-class="drawer-navigation__link--active"
        @click="emit('update:modelValue', false)"
      >
        <span class="drawer-navigation__icon" aria-hidden="true">
          <v-icon icon="mdi-post-outline" size="21" />
        </span>
        <span>Blog</span>
      </NuxtLink>
    </nav>

    <!-- Info pages, right below the favorites section. Collapsed by default. -->
    <v-divider />
    <v-expansion-panels variant="accordion" flat>
      <v-expansion-panel bg-color="transparent" elevation="0">
        <v-expansion-panel-title class="drawer-pages__title">
          <v-icon icon="mdi-dots-horizontal-circle-outline" size="20" class="mr-3" aria-hidden="true" />
          Autres pages
        </v-expansion-panel-title>
        <v-expansion-panel-text class="drawer-pages__content">
          <nav class="drawer-navigation drawer-navigation--compact" aria-label="Pages d’information">
            <NuxtLink
              v-for="page in infoPages"
              :key="page.to"
              :to="page.to"
              class="drawer-navigation__link"
              active-class="drawer-navigation__link--active"
              @click="emit('update:modelValue', false)"
            >
              <span class="drawer-navigation__icon" aria-hidden="true">
                <v-icon :icon="page.icon" size="21" />
              </span>
              <span>{{ page.label }}</span>
            </NuxtLink>
          </nav>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </v-navigation-drawer>
</template>

<style scoped>
.drawer-navigation {
  display: grid;
  gap: 4px;
  padding: 12px 10px;
}

.drawer-navigation__link {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 46px;
  padding: 0 12px;
  border-radius: 12px;
  color: rgba(var(--v-theme-on-surface), 0.72);
  font-size: 0.9rem;
  font-weight: 650;
  text-decoration: none;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.drawer-navigation__link:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
  color: rgb(var(--v-theme-on-surface));
}

.drawer-navigation__link--active {
  background: rgba(var(--v-theme-primary), 0.14);
  color: rgb(var(--v-theme-primary));
}

.drawer-navigation__link:focus-visible {
  outline: 3px solid rgb(var(--v-theme-primary));
  outline-offset: 4px;
}

.drawer-navigation__icon {
  position: relative;
  display: grid;
  place-items: center;
}

.drawer-navigation__live-dot {
  position: absolute;
  top: 0;
  right: -3px;
  width: 7px;
  height: 7px;
  border: 2px solid rgb(var(--v-theme-surface));
  border-radius: 50%;
  background: rgb(var(--v-theme-error));
}

/* "Autres pages" panel pinned at the bottom of the drawer */
.drawer-pages__title {
  min-height: 46px;
  padding: 0 14px;
  color: rgba(var(--v-theme-on-surface), 0.72);
  font-size: 0.9rem;
  font-weight: 650;
}

/* Remove Vuetify's default inner padding so links align with the main nav */
.drawer-pages__content :deep(.v-expansion-panel-text__wrapper) {
  padding: 0;
}

.drawer-navigation--compact {
  padding: 4px 10px 10px;
}

.drawer-header {
  background:
    linear-gradient(135deg, rgba(var(--v-theme-primary), 0.14), transparent 62%),
    rgba(var(--v-theme-surface), 0.55);
    background: rgba(var(--v-theme-on-surface), 0.04);
}

.drawer-header__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.drawer-header__status {
  gap: 12px;  
}

.drawer-home-link {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  gap: 12px;
  border-radius: 12px;
  color: rgb(var(--v-theme-on-surface));
  outline-offset: 4px;
  text-decoration: none;
}

.drawer-home-link:hover .drawer-brand-name {
  color: rgb(var(--v-theme-primary));
}

.drawer-brand-mark {
  width: 44px;
  height: 44px;
  place-items: center;
  border: 1px solid rgba(var(--v-theme-primary), 0.25);
  color: rgb(var(--v-theme-primary));
}

.icon-dark-mode {
  border-radius: 20%;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.25);
  transition: all 0.4s ease;
}


.drawer-brand-copy {
  min-width: 0;
}

.drawer-brand-name,
.drawer-brand-caption {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drawer-brand-name {
  font-size: 1rem;
  font-weight: 750;
  line-height: 1.3;
  transition: color 0.2s ease;
}

.drawer-brand-caption {
  margin-top: 2px;
  color: rgba(var(--v-theme-on-surface), 0.64);
  font-size: 0.75rem;
  line-height: 1.3;
}

@media (prefers-reduced-motion: reduce) {
  .drawer-brand-name {
    transition: none;
  }
}
</style>

<style>
/*
  Tilt the crescent-moon glyph. Icons are inline SVGs now (no .mdi-* font
  classes), so we rotate the button's icon only while the moon is shown.
*/
.icon-dark-mode--moon .v-icon {
  transform: rotate(-45deg);
}
</style>