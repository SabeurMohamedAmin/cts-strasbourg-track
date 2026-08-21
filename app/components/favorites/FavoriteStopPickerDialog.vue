<script setup lang="ts">
import type { Stop } from '~/stores/stops'
import { searchStops } from '~/utils/stopSearch'

const props = defineProps<{
  modelValue: boolean
  groupName: string
  stops: Stop[]
  selectedStopIds: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  select: [stopId: string]
}>()

const query = ref('')
const delayedQuery = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    query.value = ''
    delayedQuery.value = ''
  }
})

watch(query, (value) => {
  const normalizedValue = typeof value === 'string' ? value : ''
  if (normalizedValue !== value) {
    query.value = normalizedValue
    return
  }

  clearTimeout(searchTimer)
  delayedQuery.value = ''
  if (normalizedValue.trim().length < 3) return
  searchTimer = setTimeout(() => { delayedQuery.value = normalizedValue }, 250)
})

onBeforeUnmount(() => clearTimeout(searchTimer))

const results = computed(() => searchStops(props.stops, delayedQuery.value, 30))
const hasSearch = computed(() => typeof query.value === 'string' && query.value.trim().length >= 3)

function close() { emit('update:modelValue', false) }
function selectStop(stopId: string) {
  emit('select', stopId)
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    class="station-picker"
    scrim="rgba(3, 8, 20, .68)"
    max-width="1120"
    persistent
    opacity="0.8"
    transition="dialog-bottom-transition"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card class="station-picker__surface">
      <header class="station-picker__header">
        <div class="station-picker__title-row">
          <span class="station-picker__icon" aria-hidden="true"><v-icon icon="mdi-map-marker-plus-outline" size="24" /></span>
          <div class="flex-grow-1">
            <p class="station-picker__eyebrow">Ajouter à vos favoris</p>
            <h2 class="station-picker__title">Choisir un arrêt</h2>
            <p class="station-picker__subtitle">Groupe « {{ groupName }} »</p>
          </div>
          <v-btn icon="mdi-close" variant="text" size="large" aria-label="Fermer la recherche" @click="close" />
        </div>

        <v-text-field
          v-model="query"
          autofocus
          clearable
          class="station-picker__search"
          density="comfortable"
          hide-details
          placeholder="Nom d’arrêt, lieu ou ligne"
          prepend-inner-icon="mdi-magnify"
          type="search"
          variant="solo"
          @keydown.esc="close"
        />
      </header>

      <main class="station-picker__content">
        <div v-if="!hasSearch" class="station-picker__state" role="status">
          <span class="station-picker__state-icon" aria-hidden="true"><v-icon icon="mdi-magnify" size="32" /></span>
          <h3>Recherchez un arrêt</h3>
          <p>Saisissez au moins 3 caractères pour trouver un arrêt CTS et l’ajouter à ce groupe.</p>
        </div>

        <template v-else>
          <div class="station-picker__results-heading">
            <span>{{ results.length }} résultat{{ results.length !== 1 ? 's' : '' }}</span>
            <span>pour « {{ delayedQuery }} »</span>
          </div>
          <v-list v-if="results.length" class="station-picker__results" aria-label="Résultats de recherche">
            <v-list-item
              v-for="stop in results"
              :key="stop.stopId"
              class="station-picker__result"
              :disabled="selectedStopIds.includes(stop.stopId)"
              @click="selectStop(stop.stopId)"
            >
              <template #prepend>
                <span class="station-picker__mode" :class="{ 'station-picker__mode--tram': stop.modes.includes('tram') }" aria-hidden="true"><v-icon :icon="stop.modes.includes('tram') ? 'mdi-tram' : 'mdi-bus'" size="20" /></span>
              </template>
              <v-list-item-title>{{ stop.stopName }}</v-list-item-title>
              <v-list-item-subtitle>{{ stop.modes.includes('tram') ? 'Tram' : 'Bus' }} · Appuyez pour ajouter</v-list-item-subtitle>
              <template #append><v-chip v-if="selectedStopIds.includes(stop.stopId)" size="small" variant="tonal">Déjà ajouté</v-chip><span v-else class="station-picker__add" aria-hidden="true"><v-icon icon="mdi-plus" size="20" /></span></template>
            </v-list-item>
          </v-list>
          <div v-else class="station-picker__state station-picker__state--empty" role="status">
            <span class="station-picker__state-icon" aria-hidden="true"><v-icon icon="mdi-map-marker-off-outline" size="32" /></span>
            <h3>Aucun arrêt trouvé</h3>
            <p>Essayez avec un autre nom ou une autre orthographe.</p>
          </div>
        </template>
      </main>

      <footer class="station-picker__footer"><span>Les arrêts ajoutés sont enregistrés automatiquement.</span><v-btn variant="text" rounded="lg" @click="close">Annuler</v-btn></footer>
    </v-card>
  </v-dialog>
</template>

<style scoped>
:global(.station-picker .v-overlay__scrim) { backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.station-picker__surface { display:flex; height:min(760px, 84dvh); width:min(1040px, 92dvw); color:#f4f7fb; background:radial-gradient(circle at 10% -10%, rgba(var(--v-theme-primary),.25), transparent 28rem), #0a1020; }.station-picker__header { width:min(920px, 100%); margin:0 auto; padding:clamp(24px, 5vw, 52px) clamp(20px, 5vw, 48px) 24px; }.station-picker__title-row { display:flex; align-items:flex-start; gap:14px; margin-bottom:24px; }.station-picker__icon,.station-picker__state-icon,.station-picker__mode,.station-picker__add { display:grid; place-items:center; flex-shrink:0; }.station-picker__icon { width:48px; height:48px; border-radius:16px; color:rgb(var(--v-theme-primary)); background:rgba(var(--v-theme-primary),.15); }.station-picker__eyebrow { margin:0 0 4px; color:rgb(var(--v-theme-primary)); font-size:.76rem; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }.station-picker__title { margin:0; font-size:clamp(1.5rem, 4vw, 2.15rem); line-height:1.1; }.station-picker__subtitle { margin:5px 0 0; color:rgba(244,247,251,.64); }.station-picker__search :deep(.v-field) { min-height:58px; border:1px solid rgba(255,255,255,.14); border-radius:18px; color:#f4f7fb; background:rgba(255,255,255,.075); box-shadow:0 14px 34px rgba(0,0,0,.2); }.station-picker__content { width:min(920px, 100%); flex:1; overflow-y:auto; margin:0 auto; padding:0 clamp(20px, 5vw, 48px) 28px; }.station-picker__state { display:grid; justify-items:center; max-width:430px; margin:clamp(50px, 12vh, 120px) auto; text-align:center; }.station-picker__state-icon { width:68px; height:68px; margin-bottom:18px; border-radius:22px; color:rgb(var(--v-theme-primary)); background:rgba(var(--v-theme-primary),.12); }.station-picker__state h3 { margin:0 0 8px; font-size:1.15rem; }.station-picker__state p { margin:0; color:rgba(244,247,251,.64); line-height:1.55; }.station-picker__results-heading { display:flex; gap:7px; margin:5px 4px 12px; color:rgba(244,247,251,.62); font-size:.85rem; }.station-picker__results { overflow:hidden; border:1px solid rgba(255,255,255,.1); border-radius:20px; background:rgba(255,255,255,.045); }.station-picker__result { min-height:72px; padding-inline:18px; border-bottom:1px solid rgba(255,255,255,.07); transition:background .15s ease; }.station-picker__result:last-child { border-bottom:0; }.station-picker__result:not(.v-list-item--disabled):hover { background:rgba(255,255,255,.07); }.station-picker__mode { width:40px; height:40px; margin-right:12px; border-radius:13px; color:#84c8ff; background:rgba(89,158,255,.15); }.station-picker__mode--tram { color:#8ce6cc; background:rgba(66,190,153,.15); }.station-picker__add { width:34px; height:34px; border-radius:50%; color:#071021; background:rgb(var(--v-theme-primary)); }.station-picker__footer { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:14px max(20px, calc((100vw - 920px) / 2 + 48px)); border-top:1px solid rgba(255,255,255,.08); color:rgba(244,247,251,.55); font-size:.8rem; } @media (max-width:600px) { .station-picker__surface { width:100dvw; height:100dvh; border-radius:0 !important; } .station-picker__header { padding-top:28px; }.station-picker__footer { padding:12px 20px; }.station-picker__footer span { max-width:220px; } } @media (prefers-reduced-motion:reduce) { .station-picker__result { transition:none; } }
</style>