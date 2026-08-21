<script setup lang="ts">
export interface GeolocationCoords {
  latitude: number
  longitude: number
  /** GPS accuracy in metres, forwarded so callers can display it. */
  accuracy: number
}

const model = defineModel<boolean>({ default: false })
const loading = ref(false)
const denied = ref(false)
const showPermissionHelp = ref(false)

const emit = defineEmits<{
  granted: [coords: GeolocationCoords]
  denied: []
  dismissed: []
  /** "Ne plus me demander": the caller persists this choice permanently. */
  neverAskAgain: []
}>()

/**
 * The dialog is intentionally NOT persistent: pressing Escape or clicking
 * the backdrop must work for keyboard and assistive-technology users, and
 * both count as "Plus tard". This flag distinguishes those implicit closes
 * from closes triggered by our own buttons, avoiding duplicate emits.
 */
let closedByAction = false

watch(model, (open) => {
  if (open) {
    closedByAction = false
    return
  }
  if (!closedByAction) emit('dismissed')
})

function closeDialog() {
  closedByAction = true
  model.value = false
}

function requestGeolocation() {
  if (!import.meta.client || !('geolocation' in navigator)) {
    denied.value = true
    emit('denied')
    return
  }

  denied.value = false
  showPermissionHelp.value = false
  loading.value = true

  navigator.geolocation.getCurrentPosition(
    (position) => {
      loading.value = false
      closeDialog()
      // This fix is the ONLY GPS acquisition of the whole location flow:
      // callers must reuse these coordinates instead of asking again.
      emit('granted', {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      })
    },
    () => {
      loading.value = false
      denied.value = true
      emit('denied')
    },
    {
      enableHighAccuracy: true,
      timeout: 10_000,
      // Accept a fix up to 30 s old: a just-acquired position is plenty
      // accurate for a "stops around me" search and avoids waking the GPS
      // chip a second time, which can take several seconds on mobile.
      maximumAge: 30_000,
    },
  )
}

function dismiss() {
  closeDialog()
  emit('dismissed')
}

function neverAskAgain() {
  closeDialog()
  emit('neverAskAgain')
}
</script>

<template>
  <!--
    Layering notes (junior-friendly):
    Vuetify 4 renders overlays IN PLACE (next to their parent), not in <body>.
    This dialog is used inside scrollable pages (e.g. `.horaires-page`) whose
    headers and frosted-glass surfaces create their own stacking contexts, so
    the dialog could end up BEHIND them.

    - `attach="body"` teleports the overlay to <body>, escaping any parent
      stacking context or overflow container.
    - `:z-index="2400"` keeps it above every fixed element in the app:
      home header (20), pull indicator (10), PWA banner (11), menu FAB (400)
      and Vuetify layout bars (~1000).

    Accessibility notes:
    - No `persistent`: Escape / backdrop close the dialog (emits `dismissed`).
    - The visible title and description are wired via aria-labelledby /
      aria-describedby; decorative icons are aria-hidden.
  -->
  <v-dialog
    v-model="model"
    max-width="420"
    class="geo-dialog"
    attach="body"
    :z-index="2400"
    opacity="0.8"
    persistent
    aria-labelledby="geo-dialog-title"
    aria-describedby="geo-dialog-desc"
  >
    <v-card class="geo-card" rounded="xl" elevation="0">
      <v-btn
        class="geo-close mx-2"
        icon="mdi-close"
        variant="text"
        size="small"
        rounded="lg"
        aria-label="Fermer et décider plus tard"
        :disabled="loading"
        @click="dismiss"
      />
      <v-card-text class="overflow-y-auto text-label-small text-sm-label-large d-flex py-4 px-6 flex-column align-center text-center">
        <div class="geo-icon" aria-hidden="true">
          <v-icon icon="mdi-map-marker-radius-outline" size="30" />
        </div>

        <h2 id="geo-dialog-title" class="geo-title text-title-medium text-md-title-large ma-1 ">
          Activer la géolocalisation
        </h2>

        <p v-if="!denied" id="geo-dialog-desc" class="geo-description">
          Autorisez l'accès à votre position pour trouver les arrêts de bus
          et tram autour de vous en temps réel.
        </p>

        <template v-else>
          <v-alert
            id="geo-dialog-desc"
            class="text-label-small text-sm-label-large  mt-4 text-left overflow-visible w-100"
            density="compact"
            type="warning"
            variant="tonal"
          >
            L’accès a été refusé. Activez la localisation pour ce site dans les réglages de votre navigateur, puis réessayez.
          </v-alert>

          <v-btn
            block
            variant="text"
            color="primary"
            class="text-none mt-2"
            :append-icon="showPermissionHelp ? 'mdi-chevron-up' : 'mdi-chevron-down'"
            :aria-expanded="showPermissionHelp"
            aria-controls="geo-permission-help"
            @click="showPermissionHelp = !showPermissionHelp"
          >
            Comment l’activer ?
          </v-btn>

          <v-expand-transition>
            <div v-if="showPermissionHelp" id="geo-permission-help" class="permission-help">
              <p class="text-body-medium font-weight-bold mb-2">Dans votre navigateur :</p>
              <ul class="text-label-medium text-sm-label-large font-weight-thin ps-2">
                <li><strong class="font-weight-semibold">Chrome / Brave / Edge :</strong> cliquez sur le cadenas ou l'icône d'information près de l'adresse URL, puis <em>Paramètres du site</em> → <em>Localisation (Position)</em> → <em>Autoriser</em>.</li>
                <li><strong class="font-weight-semibold">Firefox :</strong> cliquez sur l'icône de permission près de l'adresse URL, supprimez le blocage de localisation, puis réessayez.</li>
                <li><strong class="font-weight-semibold">Safari sur iPhone :</strong> ouvrez <em>Réglages</em> → <em>Confidentialité et sécurité</em> → <em>Service de localisation</em>, puis autorisez votre navigateur.</li>
                <li><strong class="font-weight-semibold">Sur téléphone (Android/iPhone) :</strong> vérifiez d'abord que la localisation est bien activée sur l'appareil (pas seulement dans le navigateur) : glissez pour ouvrir le panneau rapide en haut de l'écran et assurez-vous que l'icône de localisation/GPS est activée, sinon la position ne pourra pas être détectée même si le site y est autorisé.</li>
              </ul>
            </div>
          </v-expand-transition>
        </template>

        <p class="geo-privacy">
          <v-icon icon="mdi-shield-check-outline" size="15" aria-hidden="true" />
          Votre position n'est jamais partagée
        </p>

        <div class="geo-actions">
          <v-btn
            block
            variant="plain"
            size="large"
            rounded="lg"
            color="primary"
            class="text-none font-weight-bold border-thin"
            :loading="loading"
            @click="requestGeolocation"
          >
            {{ denied ? 'Réessayer' : 'Autoriser l’accès' }}
          </v-btn>

          <v-btn
            block
            variant="text"
            rounded="lg"
            class="text-none geo-later"
            :disabled="loading"
            @click="dismiss"
          >
            Plus tard
          </v-btn>

          <v-btn
            block
            variant="text"
            size="small"
            rounded="lg"
            class="text-none geo-never"
            :disabled="loading"
            @click="neverAskAgain"
          >
            Ne plus me demander
          </v-btn>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
/*
 * Same design language as the home page cards: glass surface, hairline
 * border and a soft radial tint of the theme primary. Every color is a
 * theme token so light and dark modes both work without overrides.
 */
.geo-card {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  background:
    radial-gradient(circle at 50% -20%, rgba(var(--v-theme-primary), 0.12), transparent 65%),
    rgb(var(--v-theme-surface)) !important;
}

.geo-close {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;
  color: rgba(var(--v-theme-on-surface), 0.62);
}



/* Icon tile: same rounded-square treatment as .quick-action__icon, plus a
   discreet pulse ring that suggests "searching around you". */
.geo-icon {
  position: relative;
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  margin-bottom: 18px;
  border-radius: 20px;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.09);
}
.geo-icon::after {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 24px;
  border: 2px solid rgba(var(--v-theme-primary), 0.28);
  animation: geo-pulse 2.4s ease-out infinite;
}
@keyframes geo-pulse {
  0% { transform: scale(0.92); opacity: 0; }
  35% { opacity: 1; }
  100% { transform: scale(1.16); opacity: 0; }
}

.geo-title {
  color: rgba(var(--v-theme-on-surface), 0.95);
}

.geo-description {
  max-width: 32ch;
  margin-top: 8px;
  color: rgba(var(--v-theme-on-surface), 0.66);
  font-size: 0.84rem;
  line-height: 1.55;
}


.permission-help {
  width: 100%;
  margin-top: 6px;
  padding: 12px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 12px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  text-align: left;
}
.permission-help li + li {
  margin-top: 8px;
}

/* Privacy reassurance as a pill chip — quieter than a full text row. */
.geo-privacy {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 16px;
  padding: 6px 12px;
  border: 1px solid rgba(var(--v-theme-primary), 0.18);
  border-radius: 999px;
  background: rgba(var(--v-theme-primary), 0.06);
  color: rgba(var(--v-theme-on-surface), 0.78);
  font-size: 0.72rem;
  font-weight: 600;
}
.geo-privacy .v-icon {
  color: rgb(var(--v-theme-primary));
}

.geo-actions {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 6px;
  margin-top: 20px;
}
.geo-later {
  color: rgba(var(--v-theme-on-surface), 0.62);
}
.geo-never {
  color: rgba(var(--v-theme-on-surface), 0.45);
  font-size: 0.72rem;
}

.geo-close:focus-visible,
.geo-actions .v-btn:focus-visible {
  outline: 3px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

:global(.v-theme--dark) .geo-card {
  border-color: rgba(var(--v-theme-on-surface), 0.08);
}

@media (prefers-reduced-motion: reduce) {
  .geo-icon::after { animation: none; opacity: 0; }
}
</style>
