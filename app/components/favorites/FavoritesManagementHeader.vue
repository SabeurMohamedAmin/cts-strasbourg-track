<script setup lang="ts">
defineProps<{ totalFavorites: number }>()
defineEmits<{ createGroup: [] }>()
</script>

<template>
  <header class="management-header d-flex flex-column flex-sm-row align-sm-start ga-4 mb-5">
    <div class="flex-grow-1">
      <span class="text-label-medium text-sm-label-large text-md-body-large font-weight-black text-uppercase text-primary ls-wide">
        Organisation
      </span>
      <h1 class="text-title-medium text-sm-title-large text-md-headline-medium font-weight-black mt-1 mb-1">
        Gérer mes favoris
      </h1>
      <p class="page-subtitle text-body-small text-sm-body-medium  text-medium-emphasis ma-0">
        Créez vos groupes et organisez vos arrêts favoris.
      </p>
    </div>

    <div class="d-flex flex-wrap align-center ga-3 flex-shrink-0">
      <v-chip class="rounded-pill pa-4" variant="outlined" :disabled="totalFavorites === 0">
        <v-icon icon="mdi-star" size="17" aria-hidden="true" />
        {{ totalFavorites }} favori{{ totalFavorites !== 1 ? 's' : '' }}
      </v-chip>
      <v-btn variant="tonal" color="primary" :min-height="36" rounded="lg" to="/favoris">Voir mes favoris</v-btn>
    </div>
  </header>

  <v-row class="mb-6 mx-0" aria-label="Actions rapides">
    <v-col cols="12" sm="6">
    <v-card
      variant="plain"
      class="action-card border border-opacity-50 d-grid h-100 align-center ga-4 pa-4 rounded-lg"
      :min-height="88"
      role="button"
      tabindex="0"
      @click="$emit('createGroup')"
      @keydown.enter.prevent="$emit('createGroup')"
      @keydown.space.prevent="$emit('createGroup')"
    >
      <div class="d-flex align-center ga-2">
        <v-icon icon="mdi-folder-plus-outline" />
        <strong class="d-block text-body-medium text-sm-body-large font-weight-semibold">
          Nouveau groupe
        </strong>
      </div>
      <small class="line-clamp-2 d-block mt-1 action-card__hint text-medium-emphasis">
        Classez vos trajets par moment ou activité
      </small>
      <v-icon icon="mdi-chevron-right" aria-hidden="true" />
    </v-card>
    </v-col>
    <v-col cols="12" sm="6">
    <v-card variant="plain" class="action-card border border-opacity-50 d-grid h-100 align-center ga-4 pa-4 rounded-lg" :min-height="88" to="/">
        <div class="d-flex align-center ga-2">
            <v-icon icon="mdi-map-marker-plus-outline" />
          <strong class="d-block text-body-medium text-sm-body-large font-weight-semibold">
            Ajouter un arrêt
          </strong>
        </div>
        <small class="line-clamp-2 d-block mt-1 action-card__hint text-medium-emphasis">
          Recherchez, explorez la carte ou utilisez votre position
        </small>
      <v-icon icon="mdi-chevron-right" aria-hidden="true" />
    </v-card>
    </v-col>
  </v-row>
</template>

<style scoped>
.ls-wide { letter-spacing: .09em; }
.management-header { padding: 8px 4px; }

/*
 * Fluid, calm type scale (rem-based so it follows the user's browser
 * font-size preference; clamp() adapts it smoothly to every screen).
 */
.page-subtitle { font-size: clamp(.9rem, .85rem + .25vw, 1rem); line-height: 1.6; max-width: 55ch; }
.action-card__hint { font-size: .8125rem; line-height: 1.5; }

/* Truncate hints to two lines without cutting mid-letter. */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.action-card { min-height: 104px; background: linear-gradient(135deg, rgba(255, 255, 255, .075), rgba(255, 255, 255, .025)); box-shadow: inset 0 1px rgba(255, 255, 255, .06); cursor: pointer; transition: transform .18s ease, border-color .18s ease, background .18s ease; }
.action-card:hover { border-color: rgba(var(--v-theme-primary), .7); background: linear-gradient(135deg, rgba(var(--v-theme-primary), .2), rgba(255, 255, 255, .04)); }
.action-card:focus-visible { outline: 3px solid rgba(var(--v-theme-primary), .5); outline-offset: 3px; }
.action-card .v-icon:first-child { color: rgb(var(--v-theme-primary)); }
@media (prefers-reduced-motion: reduce) { .action-card { transition: none; } .action-card:hover { transform: none; } }
</style>