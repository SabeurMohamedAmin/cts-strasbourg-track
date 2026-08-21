<script setup lang="ts">
import { useFavoriteGroupsStore, GROUP_COLORS } from '~/stores/favoriteGroups'
import type { GroupColor } from '~/stores/favoriteGroups'

const props = defineProps<{
  modelValue: boolean
  stopId: string
  /** Optional station name shown under the dialog title for context. */
  stopName?: string
}>()
defineEmits<{ 'update:modelValue': [value: boolean] }>()

const favStore = useFavoriteGroupsStore()

const memberGroups = computed(() =>
  favStore.groups.filter(group => group.stopIds.includes(props.stopId)),
)
const isFavorite = computed(() => memberGroups.value.length > 0)

function removeFromAllFavorites() {
  favStore.removeStopFromAll(props.stopId)
}

// ── Group colour lookup ───────────────────────────────────────────
function colorHex(key: GroupColor): string {
  return GROUP_COLORS.find(c => c.key === key)?.hex ?? '#757575'
}

// ── Toggle stop membership in a group ────────────────────────────────
function toggleGroup(groupId: string) {
  const group = favStore.groups.find(g => g.id === groupId)
  if (!group) return
  group.stopIds.includes(props.stopId)
    ? favStore.removeStop(props.stopId, groupId)
    : favStore.addStop(props.stopId, groupId)
}

// ── New list inline form ────────────────────────────────────────────
const showForm = ref(false)
const newName  = ref('')
const newColor = ref<GroupColor>('teal')

function createAndAdd() {
  if (!newName.value.trim()) return
  const group = favStore.createGroup(newName.value, newColor.value)
  favStore.addStop(props.stopId, group.id)
  resetForm()
}

function resetForm() {
  showForm.value = false
  newName.value  = ''
  newColor.value = 'teal'
}

// Reset form when dialog closes
watch(() => props.modelValue, open => { if (!open) resetForm() })
</script>

<template>
  <!--
    Dialog for adding / removing the current stop from one or many
    favourite lists, and creating new lists inline.

    Usage:
      <StopsFavoriteListPicker v-model="open" :stop-id="stop.stopId" />
      <StopsFavoriteListPicker v-model="open" :stop-id="stop.stopId" :stop-name="stop.stopName" />

    The card uses the shared glass utilities (global.css) with an explicit
    surface fallback so the background is NEVER transparent, in both themes
    and in browsers without backdrop-filter support.
  -->
  <v-dialog
    :model-value="modelValue"
    max-width="360"
    aria-labelledby="favorite-picker-title"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card rounded="xl" class="glass-surface glass-surface--strong fav-picker">

      <!-- Header -->
      <header class="fav-picker__header">
        <span class="fav-picker__badge" aria-hidden="true">
          <v-icon :icon="isFavorite ? 'mdi-star' : 'mdi-star-plus-outline'" color="amber" size="20" />
        </span>
        <div class="fav-picker__titles">
          <span id="favorite-picker-title" class="fav-picker__title">
            {{ isFavorite ? 'Gérer les favoris' : 'Ajouter aux favoris' }}
          </span>
          <span v-if="stopName" class="fav-picker__subtitle">{{ stopName }}</span>
        </div>
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          density="comfortable"
          aria-label="Fermer la fenêtre des favoris"
          @click="$emit('update:modelValue', false)"
        />
      </header>

      <v-divider />

      <!-- Group list with checkboxes -->
      <v-list density="compact" class="fav-picker__list py-1" aria-label="Groupes de favoris">
        <v-list-item
          v-for="group in favStore.groups"
          :key="group.id"
          :ripple="true"
          class="px-4"
          @click="toggleGroup(group.id)"
        >
          <template #prepend>
            <span
              class="color-dot mr-3"
              :style="{ background: colorHex(group.color) }"
            />
          </template>

          <v-list-item-title class="text-body-2">
            {{ group.name }}
          </v-list-item-title>
          <v-list-item-subtitle v-if="group.stopIds.length" class="text-caption">
            {{ group.stopIds.length }}
            arrêt{{ group.stopIds.length > 1 ? 's' : '' }}
          </v-list-item-subtitle>

          <template #append>
            <div class="d-flex align-center ga-2">
              <span
                v-if="group.stopIds.includes(stopId)"
                class="text-caption text-medium-emphasis d-none d-sm-inline"
              >
                Retirer du groupe
              </span>
              <v-checkbox-btn
                :model-value="group.stopIds.includes(stopId)"
                color="amber"
                density="compact"
                hide-details
                :aria-label="group.stopIds.includes(stopId)
                  ? `Retirer l’arrêt du groupe ${group.name}`
                  : `Ajouter l’arrêt au groupe ${group.name}`"
                @click.stop="toggleGroup(group.id)"
              />
            </div>
          </template>
        </v-list-item>
      </v-list>

      <template v-if="isFavorite">
        <v-divider />
        <div class="px-4 py-3">
          <v-btn
            block
            color="error"
            prepend-icon="mdi-star-off-outline"
            variant="tonal"
            @click="removeFromAllFavorites"
          >
            Retirer de tous les favoris
          </v-btn>
          <p class="text-caption text-medium-emphasis text-center mt-2 mb-0" aria-live="polite">
            Présent dans {{ memberGroups.length }} groupe{{ memberGroups.length > 1 ? 's' : '' }}.
          </p>
        </div>
      </template>

      <v-divider />

      <!-- Inline new-list creation -->
      <div class="px-4 py-3">

        <!-- Trigger -->
        <div
          v-if="!showForm"
          class="fav-picker__new d-flex align-center ga-2 text-primary"
          role="button"
          tabindex="0"
          aria-label="Créer une nouvelle liste de favoris"
          @click="showForm = true"
          @keydown.enter="showForm = true"
          @keydown.space.prevent="showForm = true"
        >
          <v-icon icon="mdi-plus-circle-outline" size="18" aria-hidden="true" />
          <span class="text-body-2 font-weight-medium">Nouvelle liste</span>
        </div>

        <!-- Form -->
        <template v-else>
          <v-text-field
            v-model="newName"
            autofocus
            density="compact"
            hide-details
            label="Nom de la liste"
            maxlength="32"
            variant="outlined"
            @keydown.enter="createAndAdd"
            @keydown.esc="resetForm"
          />

          <!-- Colour swatches: selected state uses a check mark, never colour alone -->
          <div
            class="d-flex ga-2 mt-2 flex-wrap"
            role="group"
            aria-label="Couleur de la nouvelle liste"
          >
            <button
              v-for="c in GROUP_COLORS"
              :key="c.key"
              type="button"
              class="color-swatch"
              :class="{ selected: newColor === c.key }"
              :style="{ background: c.hex }"
              :aria-label="`Couleur ${c.label}`"
              :aria-pressed="newColor === c.key"
              @click="newColor = c.key"
            >
              <v-icon
                v-if="newColor === c.key"
                icon="mdi-check"
                size="14"
                class="swatch-check"
                aria-hidden="true"
              />
            </button>
          </div>

          <div class="d-flex ga-2 mt-3 justify-end">
            <v-btn size="small" variant="text" @click="resetForm">Annuler</v-btn>
            <v-btn
              size="small"
              color="primary"
              variant="flat"
              :disabled="!newName.trim()"
              @click="createAndAdd"
            >
              Créer et ajouter
            </v-btn>
          </div>
        </template>
      </div>
    </v-card>
  </v-dialog>
</template>



<style scoped>
/*
  Explicit surface fallback UNDER the glass utility: even if backdrop-filter
  or the utility classes are unavailable, the card keeps an opaque themed
  background instead of rendering transparent over the page.
*/
.fav-picker {
  background-color: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-on-surface), .08);
}

.fav-picker__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 12px 12px 16px;
}
.fav-picker__badge {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  border-radius: 12px;
  background: rgba(255, 193, 7, .14);
}
.fav-picker__titles {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 1px;
}
.fav-picker__title {
  font-size: 1rem;
  font-weight: 750;
  line-height: 1.3;
}
.fav-picker__subtitle {
  overflow: hidden;
  color: rgba(var(--v-theme-on-surface), .6);
  font-size: .74rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fav-picker__list {
  background: transparent;
}

.fav-picker__new {
  border-radius: 8px;
  cursor: pointer;
  padding: 4px 2px;
}
.fav-picker__new:focus-visible {
  outline: 3px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.color-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.color-swatch {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 120ms ease, border-color 120ms ease;
}
.color-swatch:hover { transform: scale(1.12); }
.color-swatch:focus-visible {
  outline: 3px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
.color-swatch.selected {
  border-color: rgba(var(--v-theme-on-surface), .55);
  transform: scale(1.15);
}
.swatch-check {
  color: #fff;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, .45));
}

@media (prefers-reduced-motion: reduce) {
  .color-swatch { transition: none; }
}
</style>
