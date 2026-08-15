<script setup lang="ts">
  import MapView from '~/components/map/MapView.vue'
  import StopSheet from '~/components/stops/StopSheet.vue'
  import VehicleSheet from '~/components/vehicles/VehicleSheet.vue'
  import LineFilterChips from '~/components/ui/LineFilterChips.vue'
</script>

<template>
  <!--
    LIVE tab — the real-time map experience (previously the home page).
    The app chrome (drawer, theme, bottom nav) lives in layouts/default.vue;
    this page only renders the map and its overlays.
  -->
  <div class="live-page">
    <!-- Full-screen map -->
    <MapView />

    <!-- Line filter chips overlaid at the bottom of the map -->
    <LineFilterChips />

    <!-- Bottom sheets -->
    <StopSheet />
    <VehicleSheet />
  </div>
</template>

<style scoped>
  /* Fill all the space <v-main> gives us; the map handles its own sizing. */
  .live-page {
    position: relative;
    flex: 1 1 0;
    height: 100%;
    width: 100%;
    overflow: hidden;
  }
</style>
