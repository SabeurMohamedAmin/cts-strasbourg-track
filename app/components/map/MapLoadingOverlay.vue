<!--
  MapLoadingOverlay (Step 3.1)

  Branded loading overlay shown while the CTS network is loading:
  spinner with a tram icon over a blurred, translucent backdrop.

  Dumb component: no props, no events, no store access.
  Visibility (v-if) and the fade transition are owned by the parent.
-->
<template>
  <div
    class="map-state d-flex flex-column align-center justify-center map-state--translucent"
    role="status"
    aria-live="polite"
  >
    <v-progress-circular color="primary" indeterminate size="64" width="4">
      <v-icon icon="mdi-tram" size="28" color="primary" />
    </v-progress-circular>
    <span class="mt-4 text-body-1 font-weight-medium">Chargement du réseau CTS…</span>
    <span class="mt-1 text-caption text-medium-emphasis">Lignes, arrêts et véhicules en temps réel</span>
  </div>
</template>

<style scoped>
.map-state {
  position: absolute;
  inset: 0;
  z-index: 5;
}
.map-state--translucent {
  background-color: rgb(var(--v-theme-surface) / 0.78);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
</style>
