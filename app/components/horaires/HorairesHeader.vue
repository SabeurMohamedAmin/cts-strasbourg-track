<script setup lang="ts">
import HomeSearch from '~/components/ui/HomeSearch.vue'
import ConnectionStatusChip from '~/components/ui/ConnectionStatusChip.vue'

const header = useTemplateRef<HTMLElement>('header')
const toggleDrawer = inject<() => void>('toggleAppDrawer', () => {})
const setHomeHeaderOutOfView = inject<(isOutOfView: boolean) => void>('setHomeHeaderOutOfView', () => {})

let headerObserver: IntersectionObserver | undefined

onMounted(() => {
  headerObserver = new IntersectionObserver(([entry]) => {
    setHomeHeaderOutOfView(!entry?.isIntersecting)
  })

  if (header.value) headerObserver.observe(header.value)
})

onBeforeUnmount(() => {
  headerObserver?.disconnect()
  setHomeHeaderOutOfView(false)
})
</script>

<template>
  <header ref="header" class="home-header py-1 px-2">
    <div class="top-bar">
      <v-btn variant="tonal" size="x-small" type="button" class="menu-button h-100 rounded-lg" aria-label="Ouvrir le menu" @click="toggleDrawer">
        <v-icon icon="mdi-menu" size="26  " aria-hidden="true" />
      </v-btn>
      <div class="search-slot"><HomeSearch /></div>
      <ConnectionStatusChip variant="chip" />
    </div>
  </header>
</template>

<style scoped>
.home-header { 
  position: relative; 
  z-index: 20; 
  width: min(100%, 960px);
   margin-inline: auto; 
  }
.top-bar { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; align-items: center; gap: 9px; }
.search-slot { min-width: 0; }
.menu-button { border: 1px solid rgba(var(--v-theme-on-surface), .08); background: rgba(var(--v-theme-surface), .72); }
.menu-button:hover { background: rgba(var(--v-theme-on-surface), .09); }
.menu-button:focus-visible { outline: 3px solid rgb(var(--v-theme-primary)); outline-offset: 4px; }
:deep(.search-bar) { height: 44px; border-radius: 13px; background: rgba(var(--v-theme-surface), .72); box-shadow: none; }
:deep(.search-bar--open) { border-radius: 13px; }
@media (max-width: 380px) { .top-bar { grid-template-columns: 42px minmax(0, 1fr) auto; gap: 6px; } }
</style>