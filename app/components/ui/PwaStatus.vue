<script setup lang="ts">
  import { useEventListener, useOnline } from '@vueuse/core'

  // Reactive online/offline state. VueUse listens to the browser
  // events for us and cleans up when the component unmounts.
  const online = useOnline()

  // The captured install event. null = installation not available.
  // BeforeInstallPromptEvent is declared in app/types/pwa-events.d.ts
  const installPrompt = shallowRef<BeforeInstallPromptEvent | null>(null)

  // The browser fires this when the app is installable.
  // We keep the event so we can trigger the install dialog later.
  useEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    installPrompt.value = event
  })

  // Once installed, hide the install button.
  useEventListener('appinstalled', () => { installPrompt.value = null})

  async function install() {
    if (!installPrompt.value) return
    await installPrompt.value.prompt()
    installPrompt.value = null
  }

</script>

<template>
  <div class="pwa-status rounded-lg pointer-event-none">
    <v-alert
      v-if="!online"
      density="compact"
      icon="mdi-wifi-off"
      text="Vous êtes hors ligne. La carte peut être limitée."
      type="warning"
      variant="tonal"
      class="px-6 py-5"
    />

    <v-btn
      v-if="installPrompt"
      class="mt-2"
      color="primary"
      elevation="4"
      prepend-icon="mdi-download"
      @click="install"
    >
      Installer l’application
    </v-btn>
  </div>
</template>

<style scoped>
.pwa-status {
  position: fixed;
  top: 120px;
  left: 50%;
  z-index: 999;
  pointer-events: none;
  transform: translateX(-50%);
  background-color: rgba(var(--v-theme-surface) ,0.9);
  width: min(360px, calc(100vw - 24px));
}

.pwa-status > * { 
  pointer-events: auto;
}

@media (max-width: 600px) {
  .pwa-status { top: 108px; }
}
</style>
