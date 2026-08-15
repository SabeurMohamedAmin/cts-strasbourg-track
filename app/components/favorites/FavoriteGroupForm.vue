<script setup lang="ts">
import { GROUP_COLORS, type GroupColor } from '~/stores/favoriteGroups'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean], submit: [name: string, color: GroupColor] }>()

const name = ref('')
const color = ref<GroupColor>('blue')

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) { name.value = ''; color.value = 'blue' }
})

const isNameValid = computed(() => name.value.trim().length >= 3)

function submit() {
  const trimmedName = name.value.trim()
  if (!isNameValid.value) return
  emit('submit', trimmedName, color.value)
}
</script>

<template>
  <v-expand-transition>
    <v-card
      v-if="modelValue"
      tag="form"
      class="create-group-card d-grid ga-5 pa-5 rounded-xl mb-6"
      elevation="0"
      aria-labelledby="create-group-title"
      @submit.prevent="submit"
    >
      <div class="d-flex align-start ga-3">
        <span class="header-icon rounded-lg d-flex align-center justify-center" aria-hidden="true">
          <v-icon icon="mdi-folder-plus-outline" size="20" />
        </span>
        <div>
          <h2 id="create-group-title" class="text-h6 font-weight-bold ma-0">
            Nouveau groupe
          </h2>
          <p class="text-body-2 text-medium-emphasis ma-0 mt-1">
            Créez une catégorie facile à retrouver.
          </p>
        </div>
      </div>

      <v-text-field
        v-model="name"
        label="Nom du groupe"
        placeholder="Ex. Quotidien"
        variant="outlined"
        density="comfortable"
        class="input-focus-custom"
        rounded="lg"
        minlength="3"
        maxlength="32"
        counter
        autofocus
        :error="name.length > 0 && !isNameValid"
        :error-messages="name.length > 0 && !isNameValid ? 'Saisissez au moins 3 caractères.' : []"
        @keydown.esc="emit('update:modelValue', false)"
      />

      <fieldset class="color-picker">
        <legend class="text-body-2 font-weight-bold text-medium-emphasis mb-3">Couleur du groupe</legend>
        <div class="d-flex flex-wrap ga-3">
          <label
            v-for="option in GROUP_COLORS"
            :key="option.key"
            class="swatch d-grid place-items-center rounded-circle"
            :class="{ selected: color === option.key }"
            :style="{ background: option.hex }"
          >
            <input v-model="color" class="sr-only" type="radio" name="group-color" :value="option.key" :aria-label="option.label">
            <v-icon v-if="color === option.key" icon="mdi-check" size="16" class="check-icon" aria-hidden="true" />
          </label>
        </div>
      </fieldset>

      <div class="d-flex flex-wrap justify-end ga-3 pt-1">
        <v-btn variant="text" rounded="lg" :min-height="44" @click="emit('update:modelValue', false)">
          Annuler
        </v-btn>
        <v-btn
          color="primary"
          type="submit"
          rounded="lg"
          :min-height="44"
          :disabled="!isNameValid"
          append-icon="mdi-arrow-right"
        >
          Créer le groupe
        </v-btn>
      </div>
    </v-card>
  </v-expand-transition>
</template>

<style scoped>
.create-group-card {
  background: linear-gradient(135deg, rgba(255, 255, 255, .075), rgba(255, 255, 255, .025));
  box-shadow: inset 0 1px rgba(255, 255, 255, .06);
  border: 1px solid rgba(var(--v-theme-on-surface), .1);
}

.header-icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), .12);
}

.color-picker { margin: 0; padding: 0; border: 0; }

.swatch {
  width: 38px;
  height: 38px;
  color: white;
  cursor: pointer;
  transition: transform .18s ease, box-shadow .18s ease;
}

.swatch:hover { transform: scale(1.12); }

.swatch.selected {
  transform: scale(1.05);
  box-shadow:
    0 0 0 2px rgb(var(--v-theme-surface)),
    0 0 0 4px rgb(var(--v-theme-primary));
}

.check-icon { animation: pop .18s ease; }

@keyframes pop {
  from { transform: scale(0); }
  to { transform: scale(1); }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

.input-focus-custom :deep(.v-field) {
  border-radius: 12px;
}

.input-focus-custom:focus-within :deep(.v-field__outline) {
  --v-field-border-width: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .swatch { transition: none; }
  .check-icon { animation: none; }
}
</style>