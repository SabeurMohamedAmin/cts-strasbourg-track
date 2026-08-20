<script setup lang="ts">
const networkPlanUrl = '/Plan-reseau-CTS-Simple.svg'
const locating = ref(false)
const locationError = ref('')
const nearestStation = ref<{ stopName: string, distanceM: number }>()
const zoom = ref(1)

const MIN_ZOOM = 1
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25

function zoomIn() {
  zoom.value = Math.min(MAX_ZOOM, zoom.value + ZOOM_STEP)
}

function zoomOut() {
  zoom.value = Math.max(MIN_ZOOM, zoom.value - ZOOM_STEP)
}

function locateNearestStation() {
  locationError.value = ''
  nearestStation.value = undefined

  if (!navigator.geolocation) {
    locationError.value = 'La géolocalisation n’est pas disponible sur cet appareil.'
    return
  }

  locating.value = true
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        const stations = await $fetch<Array<{ stopName: string, distanceM: number }>>(
          '/api/stops/nearby',
          {
            query: {
              lat: position.coords.latitude,
              lon: position.coords.longitude,
              limit: 1,
              radius: 20_000,
            },
          },
        )

        nearestStation.value = stations[0]
        if (!nearestStation.value) {
          locationError.value = 'Aucune station CTS n’a été trouvée à proximité.'
        }
      }
      catch {
        locationError.value = 'La station la plus proche n’a pas pu être déterminée.'
      }
      finally {
        locating.value = false
      }
    },
    (error) => {
      locating.value = false
      locationError.value = error.code === error.PERMISSION_DENIED
        ? 'Autorisez la localisation dans votre navigateur.'
        : 'Votre position n’a pas pu être déterminée. Réessayez à l’extérieur.'
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15_000,
    },
  )
}

useSeoMeta({
  title: 'Plans de Notre Reseau Transport',
  description: 'voici notre Plans et Lignes de Bus & Tram du reseau CTS Strasbourg.',
})
</script>

<template>
  <v-main class="h-100 overflow-y-auto bg-surface">
    <v-container fluid
      class="plans-container pa-1">
      <header class="d-flex flex-column flex-sm-row align-sm-center justify-space-between ga-4 px-4 mt-5 mb-2">
        <div>
          <h1 class="text-title-large font-weight-bold">Plans de Notre Reseau Transport</h1>
          <p class="text-body-medium text-medium-emphasis mt-1 mb-0">
            voici notre Plans et Lignes de Bus & Tram du reseau CTS Strasbourg.
          </p>
        </div>

        <div class="d-flex flex-wrap ga-2">
          <v-btn prepend-icon="mdi-crosshairs-gps"
            variant="tonal"
            color="primary"
            :loading="locating"
            @click="locateNearestStation">
            Station proche
          </v-btn>
          <v-btn :href="networkPlanUrl"
            target="_blank"
            rel="noopener"
            prepend-icon="mdi-open-in-new"
            variant="tonal">
            Plein écran
          </v-btn>
          <v-btn :href="networkPlanUrl"
            download="Plan-reseau-CTS-Simple.svg"
            prepend-icon="mdi-download"
            color="primary">
            Télécharger
          </v-btn>
        </div>
      </header>

      <v-alert v-if="nearestStation"
        class="mx-2 mb-3"
        type="success"
        variant="tonal"
        icon="mdi-map-marker-radius">
        Station la plus proche :
        <strong>{{ nearestStation.stopName }}</strong>
        <span class="text-medium-emphasis">
          · à environ {{ Math.round(nearestStation.distanceM) }} m
        </span>
      </v-alert>

      <v-alert v-if="locationError"
        class="mx-2 mb-3"
        type="warning"
        variant="tonal"
        closable
        @click:close="locationError = ''">
        {{ locationError }}
      </v-alert>

      <v-card class="plan-card"
        rounded="xl">
        <div class="zoom-controls border rounded-xl pa-1 mx-2"
          aria-label="Contrôles de zoom">
          <v-btn icon="mdi-plus"
            size="small"
            color="surface"
            elevation="3"
            :disabled="zoom >= MAX_ZOOM"
            aria-label="Zoomer"
            @click="zoomIn" />
          <v-btn icon="mdi-minus"
            size="small"
            color="surface"
            elevation="3"
            :disabled="zoom <= MIN_ZOOM"
            aria-label="Dézoomer"
            @click="zoomOut" />
        </div>

        <div class="plan-scroll"
          tabindex="0"
          aria-label="Plan simplifié du réseau CTS, zone défilable">
          <img :src="networkPlanUrl"
            class="plan-image"
            :style="{ width: `${zoom * 100}%` }"
            alt="Plan simplifié des lignes de bus et tram du réseau CTS">
        </div>
      </v-card>

      <v-alert class="mt-4 rounded-xl py-5"
        type="info"
        variant="tonal"
        density="comfortable">
        Utilisez « Station proche » pour connaître l’arrêt CTS le plus proche de votre position.
      </v-alert>
    </v-container>
  </v-main>
</template>

<style scoped>
.plans-container {
  width: min(100%, 1100px);
  max-width: 1030px;
  user-select: none;
}

.plan-card {
  position: relative;
  overflow: hidden;
  background-color: rgba(250, 235, 215, 0.4);
}

.zoom-controls {
  background: rgba(128, 128, 128, 0.5);
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.plan-scroll {
  overflow: auto;
  max-height: calc(100dvh - 230px);
  min-height: 420px;
  overscroll-behavior: contain;

}

.plan-image {
  display: block;
  min-width: 680px;
  max-width: none;
  height: auto;
  margin-inline: auto;
  transition: width 180ms ease;
}

@media (min-width: 960px) {
  .plan-image {
    min-width: 0;
  }
}

@media (max-width: 599px) {
  .zoom-controls {
    top: 8px;
    right: 8px;
  }

  .plan-scroll {
    max-height: calc(100dvh - 280px);
    min-height: 360px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .plan-image {
    transition: none;
  }
}
</style>
