<template>
  <!--
    App shell entry point.

    The shared Vuetify chrome (theme, drawer, bottom tab bar) lives in
    layouts/default.vue — pages only render their own content.

    `keepalive` keeps pages mounted when switching tabs, so the MapLibre
    instance on /live is NOT destroyed and re-created on every navigation
    (map initialization is expensive).
  -->
  <NuxtLayout>
    <NuxtPage keepalive />
  </NuxtLayout>
</template>
