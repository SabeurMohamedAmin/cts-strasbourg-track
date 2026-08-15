<script setup lang="ts">
import {
  useFavoriteGroupsStore,
  GROUP_COLORS,
  DEFAULT_GROUP_ID,
  type GroupColor,
} from '~/stores/favoriteGroups'
import { useStopsStore } from '~/stores/stops'

const store      = useFavoriteGroupsStore()
const stopsStore = useStopsStore()

onMounted(store.hydrate)

// ── Panel toggle ──────────────────────────────────────────────────────────────
const isOpen = ref(false)
function toggle() { isOpen.value = !isOpen.value }
function close()  {
  isOpen.value = false
  colorPickerGroupId.value = null
  moveMenu.value = null
}

// Close popovers on outside click
if (import.meta.client) {
  window.addEventListener('click', () => {
    colorPickerGroupId.value = null
    moveMenu.value = null
  })
}

// ── Counts ──────────────────────────────────────────────────────────────────
const totalCount = computed(() =>
  store.groups.reduce((s, g) => s + g.stopIds.length, 0),
)

// ── Stop name lookup ────────────────────────────────────────────────────────
function stopName(id: string): string {
  return stopsStore.stops.find(s => s.stopId === id)?.stopName ?? id
}

// ── Select stop on map ───────────────────────────────────────────────────────
function selectStop(stopId: string) {
  stopsStore.selectStop(stopId)
  if (import.meta.client && window.innerWidth < 640) close()
}

// ── Inline rename ───────────────────────────────────────────────────────────
const renamingId     = ref<string | null>(null)
const renameValue    = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

function startRename(groupId: string) {
  const g = store.groups.find(g => g.id === groupId)
  if (!g) return
  renamingId.value  = groupId
  renameValue.value = g.name
  nextTick(() => renameInputRef.value?.select())
}
function commitRename() {
  if (renamingId.value) store.renameGroup(renamingId.value, renameValue.value)
  renamingId.value = null
}
function cancelRename() { renamingId.value = null }

// ── Colour picker ───────────────────────────────────────────────────────────
const colorPickerGroupId = ref<string | null>(null)
function toggleColorPicker(id: string) {
  colorPickerGroupId.value = colorPickerGroupId.value === id ? null : id
}
function pickColor(groupId: string, color: GroupColor) {
  store.setGroupColor(groupId, color)
  colorPickerGroupId.value = null
}
function colorHex(key: GroupColor): string {
  return GROUP_COLORS.find(c => c.key === key)?.hex ?? '#757575'
}

// ── Delete group ────────────────────────────────────────────────────────────
const deleteConfirmId = ref<string | null>(null)
function confirmDelete(id: string) { deleteConfirmId.value = id }
function executeDelete(id: string)  { store.deleteGroup(id); deleteConfirmId.value = null }

// ── Move stop ─────────────────────────────────────────────────────────────────
const moveMenu = ref<{ groupId: string; stopId: string } | null>(null)
function toggleMoveMenu(gId: string, sId: string) {
  const same = moveMenu.value?.groupId === gId && moveMenu.value?.stopId === sId
  moveMenu.value = same ? null : { groupId: gId, stopId: sId }
}
function otherGroups(currentId: string) {
  return store.groups.filter(g => g.id !== currentId)
}
function doMove(stopId: string, from: string, to: string) {
  store.moveStop(stopId, from, to)
  moveMenu.value = null
}

// ── Add group form ───────────────────────────────────────────────────────────
const addingGroup      = ref(false)
const newGroupName     = ref('')
const newGroupColor    = ref<GroupColor>('blue')
const addGroupInputRef = ref<HTMLInputElement | null>(null)
const bodyRef          = ref<HTMLElement | null>(null)

function startAddGroup() {
  newGroupName.value  = ''
  newGroupColor.value = 'blue'
  addingGroup.value   = true
  nextTick(() => {
    addGroupInputRef.value?.focus()
    bodyRef.value?.scrollTo({ top: bodyRef.value.scrollHeight, behavior: 'smooth' })
  })
}
function submitNewGroup() {
  if (newGroupName.value.trim()) store.createGroup(newGroupName.value, newGroupColor.value)
  addingGroup.value = false
}
</script>

<template>
  <!--
    FavoritePanel — redesigned left-side favourites drawer.

    Trigger: a clean floating pill button anchored below the search panel
             (not a side FAB — far more discoverable and less intrusive).

    Panel: a full-height drawer that slides in from the left, sits on top of
           the map with a semi-transparent backdrop on mobile.

    Features:
      · Named, coloured groups with collapse toggle
      · Inline rename (double-click name or pencil icon)
      · 7-colour swatch picker per group
      · Move stop between groups via contextual menu
      · Confirm-before-delete for custom groups
      · Add new group with name + colour form
      · Full dark-mode via Vuetify CSS vars
      · Mobile: 85vw drawer, backdrop tap-to-close
  -->

  <!-- ─── Trigger pill (always visible) ─────────────────────────────────────── -->
  <button
    class="fp-trigger"
    :class="{ 'fp-trigger--active': isOpen }"
    :aria-label="isOpen ? 'Fermer les favoris' : 'Ouvrir les favoris'"
    :aria-expanded="String(isOpen)"
    @click.stop="toggle"
  >
    <!-- Star icon -->
    <svg class="fp-trigger__star" viewBox="0 0 16 16" fill="currentColor">
      <polygon points="8 1 10.06 5.73 15.27 6.18 11.5 9.47 12.7 14.55 8 11.75 3.3 14.55 4.5 9.47 0.73 6.18 5.94 5.73" />
    </svg>
    <span class="fp-trigger__label">Favoris</span>
    <!-- Badge -->
    <transition name="badge">
      <span v-if="totalCount > 0" class="fp-trigger__badge">{{ totalCount }}</span>
    </transition>
    <!-- Chevron -->
    <svg
      class="fp-trigger__chevron"
      :class="{ 'fp-trigger__chevron--open': isOpen }"
      viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
    >
      <path d="M2 3.5l3 3 3-3" />
    </svg>
  </button>

  <!-- ─── Backdrop (mobile) ────────────────────────────────────────────── -->
  <transition name="backdrop">
    <div v-if="isOpen" class="fp-backdrop" aria-hidden="true" @click="close" />
  </transition>

  <!-- ─── Drawer ───────────────────────────────────────────────────────── -->
  <transition name="drawer">
    <div
      v-if="isOpen"
      class="fp-drawer"
      role="dialog"
      aria-label="Arrêts favoris"
      @click.stop
    >
      <!-- Drawer header -->
      <div class="fp-drawer__header">
        <div class="fp-drawer__header-left">
          <svg class="fp-drawer__star" viewBox="0 0 16 16" fill="currentColor">
            <polygon points="8 1 10.06 5.73 15.27 6.18 11.5 9.47 12.7 14.55 8 11.75 3.3 14.55 4.5 9.47 0.73 6.18 5.94 5.73" />
          </svg>
          <span class="fp-drawer__title">Favoris</span>
          <span v-if="totalCount" class="fp-drawer__total">{{ totalCount }}</span>
        </div>
        <button class="fp-icon-btn" aria-label="Fermer" @click="close">
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>
      </div>

      <div class="fp-divider" />

      <!-- Scrollable body -->
      <div class="fp-drawer__body" ref="bodyRef">

        <!-- Global empty state -->
        <div v-if="totalCount === 0" class="fp-empty">
          <svg class="fp-empty__icon" viewBox="0 0 48 48" fill="none">
            <polygon
              points="24 4 29.2 16 42.5 17.1 33 25.6 35.9 38.7 24 31.8 12.1 38.7 15 25.6 5.5 17.1 18.8 16"
              stroke="currentColor" stroke-width="2" stroke-linejoin="round"
            />
          </svg>
          <p>Aucun arrêt favori.</p>
          <small>Appuyez sur ★ sur un arrêt pour le sauvegarder.</small>
        </div>

        <!-- Groups -->
        <section
          v-for="group in store.groups"
          :key="group.id"
          class="fp-group"
        >
          <!-- Group header row -->
          <div class="fp-group__header" @dblclick="startRename(group.id)">

            <!-- Toggle + dot + name -->
            <button class="fp-group__toggle" @click="store.toggleCollapse(group.id)">
              <svg
                class="fp-group__chevron"
                :class="{ 'fp-group__chevron--up': !group.collapsed }"
                viewBox="0 0 10 10" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round"
              >
                <path d="M2 3.5l3 3 3-3" />
              </svg>
              <span class="fp-group__dot" :style="{ background: colorHex(group.color) }" />

              <!-- Inline rename input vs label -->
              <input
                v-if="renamingId === group.id"
                :ref="el => { if (el) renameInputRef = el as HTMLInputElement }"
                v-model="renameValue"
                class="fp-group__rename-input"
                maxlength="32"
                @blur="commitRename"
                @keydown.enter.prevent="commitRename"
                @keydown.esc.prevent="cancelRename"
                @click.stop
              />
              <span v-else class="fp-group__name">{{ group.name }}</span>
              <span v-if="group.stopIds.length" class="fp-group__count">{{ group.stopIds.length }}</span>
            </button>

            <!-- Actions (hover-revealed) -->
            <div class="fp-group__actions">
              <!-- Rename -->
              <button class="fp-icon-btn fp-icon-btn--sm" aria-label="Renommer" @click.stop="startRename(group.id)">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                  <path d="M11 2.5l2.5 2.5L5 13.5H2.5V11L11 2.5z" />
                </svg>
              </button>

              <!-- Colour picker -->
              <div class="fp-color-wrap" @click.stop>
                <button
                  class="fp-icon-btn fp-icon-btn--sm"
                  aria-label="Couleur"
                  @click="toggleColorPicker(group.id)"
                >
                  <span class="fp-color-dot" :style="{ background: colorHex(group.color) }" />
                </button>
                <div v-if="colorPickerGroupId === group.id" class="fp-color-picker">
                  <button
                    v-for="c in GROUP_COLORS" :key="c.key"
                    class="fp-swatch"
                    :class="{ 'fp-swatch--active': group.color === c.key }"
                    :style="{ background: c.hex }"
                    :aria-label="c.label"
                    @click="pickColor(group.id, c.key)"
                  />
                </div>
              </div>

              <!-- Delete (hidden on default group) -->
              <button
                v-if="group.id !== DEFAULT_GROUP_ID"
                class="fp-icon-btn fp-icon-btn--sm fp-icon-btn--danger"
                aria-label="Supprimer"
                @click.stop="confirmDelete(group.id)"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                  <path d="M3 4h10M6 4V2.5h4V4M5.5 4l.5 9M10.5 4l-.5 9" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Confirm-delete bar -->
          <transition name="confirm">
            <div v-if="deleteConfirmId === group.id" class="fp-confirm-bar">
              <span>Supprimer « {{ group.name }} »&nbsp;?</span>
              <button class="fp-confirm-yes" @click="executeDelete(group.id)">Oui</button>
              <button class="fp-confirm-no"  @click="deleteConfirmId = null">Non</button>
            </div>
          </transition>

          <!-- Stop list -->
          <transition name="collapse">
            <ul v-if="!group.collapsed" class="fp-stop-list">
              <li v-if="!group.stopIds.length" class="fp-stop-list__empty">Vide</li>

              <li v-for="stopId in group.stopIds" :key="stopId" class="fp-stop-row">
                <!-- Tap to select -->
                <button class="fp-stop-row__btn" @click="selectStop(stopId)">
                  <svg class="fp-stop-row__pin" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M8 1.5a4.5 4.5 0 0 1 4.5 4.5c0 4-4.5 8.5-4.5 8.5S3.5 10 3.5 6A4.5 4.5 0 0 1 8 1.5z" />
                    <circle cx="8" cy="6" r="1.5" fill="currentColor" stroke="none" />
                  </svg>
                  <span class="fp-stop-row__name">{{ stopName(stopId) }}</span>
                </button>

                <!-- Move to group -->
                <div v-if="store.groups.length > 1" class="fp-move-wrap" @click.stop>
                  <button
                    class="fp-icon-btn fp-icon-btn--xs"
                    aria-label="Déplacer vers"
                    @click="toggleMoveMenu(group.id, stopId)"
                  >
                    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                      <path d="M3 7h8M8 4l3 3-3 3" />
                    </svg>
                  </button>
                  <div
                    v-if="moveMenu?.groupId === group.id && moveMenu.stopId === stopId"
                    class="fp-move-menu"
                  >
                    <p class="fp-move-menu__label">Déplacer vers…</p>
                    <button
                      v-for="tgt in otherGroups(group.id)" :key="tgt.id"
                      class="fp-move-menu__item"
                      @click="doMove(stopId, group.id, tgt.id)"
                    >
                      <span class="fp-move-menu__dot" :style="{ background: colorHex(tgt.color) }" />
                      {{ tgt.name }}
                    </button>
                  </div>
                </div>

                <!-- Remove -->
                <button
                  class="fp-icon-btn fp-icon-btn--xs fp-icon-btn--danger"
                  :aria-label="`Retirer ${stopName(stopId)}`"
                  @click.stop="store.removeStop(stopId, group.id)"
                >
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <path d="M1 1l10 10M11 1L1 11" />
                  </svg>
                </button>
              </li>
            </ul>
          </transition>
        </section>
      </div>

      <!-- Footer: add group -->
      <div class="fp-drawer__footer">
        <transition name="form-slide">
          <div v-if="addingGroup" class="fp-add-form" @click.stop>
            <input
              ref="addGroupInputRef"
              v-model="newGroupName"
              class="fp-add-input"
              placeholder="Nom du groupe…"
              maxlength="32"
              @keydown.enter.prevent="submitNewGroup"
              @keydown.esc.prevent="addingGroup = false"
            />
            <div class="fp-add-colors">
              <button
                v-for="c in GROUP_COLORS" :key="c.key"
                class="fp-swatch"
                :class="{ 'fp-swatch--active': newGroupColor === c.key }"
                :style="{ background: c.hex }"
                :aria-label="c.label"
                @click="newGroupColor = c.key"
              />
            </div>
            <div class="fp-add-actions">
              <button class="fp-add-confirm" @click="submitNewGroup">Créer</button>
              <button class="fp-add-cancel" @click="addingGroup = false">Annuler</button>
            </div>
          </div>
        </transition>
        <button v-if="!addingGroup" class="fp-add-btn" @click="startAddGroup">
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <path d="M7 2v10M2 7h10" />
          </svg>
          Nouveau groupe
        </button>
      </div>
    </div>
  </transition>
</template>


<style scoped>
/* ─────────────────────────────────────────────────────────────────────────── */
/* Trigger pill                                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */
/*
  Positioned below the search panel (top: 56px + ~52px search height = ~116px).
  Uses the same left: 12px as .ss-root so it aligns perfectly with the search box.
  On mobile the search box is shorter so we use a slightly tighter top.
*/
.fp-trigger {
  position: fixed;
  top: 160px;
  left: 12px;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 12px 0 10px;
  border: none;
  border-radius: 18px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  box-shadow: 0 2px 10px rgba(0,0,0,.20);
  cursor: pointer;
  font-size: .78rem;
  font-weight: 600;
  transition:
    background 160ms,
    box-shadow 160ms,
    transform 120ms;
  user-select: none;
}
.fp-trigger:hover {
  background: rgb(var(--v-theme-surface-variant, var(--v-theme-surface)));
  box-shadow: 0 4px 14px rgba(0,0,0,.25);
  transform: translateY(-1px);
}
.fp-trigger:active { transform: translateY(0); }
.fp-trigger--active {
  background: rgba(var(--v-theme-primary), 1);
  color: #fff;
  box-shadow: 0 2px 12px rgba(var(--v-theme-primary), .35);
}

.fp-trigger__star {
  width: 14px; height: 14px; flex-shrink: 0;
  color: rgb(var(--v-theme-primary));
  transition: color 160ms;
}
.fp-trigger--active .fp-trigger__star { color: #fff; }

.fp-trigger__label { white-space: nowrap; }

.fp-trigger__badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 5px;
  border-radius: 9px;
  background: rgb(var(--v-theme-primary));
  color: #fff;
  font-size: .67rem; font-weight: 800;
  line-height: 1;
  transition: background 160ms;
}
.fp-trigger--active .fp-trigger__badge {
  background: rgba(255,255,255,.25);
}

.fp-trigger__chevron {
  width: 12px; height: 12px; flex-shrink: 0;
  transition: transform 220ms cubic-bezier(.16,1,.3,1);
}
.fp-trigger__chevron--open { transform: rotate(180deg); }

/* ─────────────────────────────────────────────────────────────────────────── */
/* Backdrop                                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */
.fp-backdrop {
  position: fixed; inset: 0; z-index: 18;
  background: rgba(0,0,0,.28);
  /* Only shown on mobile — hidden on desktop via media query below */
}
@media (min-width: 601px) { .fp-backdrop { display: none; } }

/* ─────────────────────────────────────────────────────────────────────────── */
/* Drawer                                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */
.fp-drawer {
  position: fixed;
  /* Aligns top with the trigger pill so it feels "attached" */
  top: 48px;
  left: 0;
  bottom: 0;
  z-index: 999;
  width: 280px;
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface));
  border-right: 1px solid rgba(var(--v-border-color), .13);
  box-shadow: 6px 0 32px rgba(0,0,0,.16);
  overflow: hidden;
}

/* ─ Drawer header ─ */
.fp-drawer__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 10px 12px 16px;
  flex-shrink: 0;
}
.fp-drawer__header-left { display: flex; align-items: center; gap: 9px; }
.fp-drawer__star { width: 15px; height: 15px; color: rgb(var(--v-theme-primary)); }
.fp-drawer__title {
  font-size: .78rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: .08em;
  color: rgb(var(--v-theme-on-surface));
}
.fp-drawer__total {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 20px; height: 20px; padding: 0 5px;
  border-radius: 10px;
  background: rgba(var(--v-theme-primary), .12);
  color: rgb(var(--v-theme-primary));
  font-size: .7rem; font-weight: 700;
}

.fp-divider { height: 1px; background: rgba(var(--v-border-color), .10); flex-shrink: 0; }

/* ─ Body ─ */
.fp-drawer__body {
  flex: 1; overflow-y: auto; padding: 4px 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--v-theme-on-surface),.08) transparent;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Generic icon button                                                          */
/* ─────────────────────────────────────────────────────────────────────────── */
.fp-icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; flex-shrink: 0;
  border: none; border-radius: 8px;
  background: transparent;
  color: rgba(var(--v-theme-on-surface), .4);
  cursor: pointer;
  transition: background 130ms, color 130ms;
}
.fp-icon-btn svg { width: 14px; height: 14px; }
.fp-icon-btn:hover {
  background: rgba(var(--v-theme-on-surface), .07);
  color: rgb(var(--v-theme-on-surface));
}
.fp-icon-btn--sm { width: 24px; height: 24px; border-radius: 6px; }
.fp-icon-btn--sm svg { width: 12px; height: 12px; }
.fp-icon-btn--xs { width: 20px; height: 20px; border-radius: 5px; }
.fp-icon-btn--xs svg { width: 10px; height: 10px; }
.fp-icon-btn--danger:hover {
  background: rgba(var(--v-theme-error), .12);
  color: rgb(var(--v-theme-error));
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Groups                                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */
.fp-group { border-bottom: 1px solid rgba(var(--v-border-color), .07); }
.fp-group:last-child { border-bottom: none; }

.fp-group__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 2px 6px 2px 2px;
}
.fp-group__toggle {
  flex: 1; display: flex; align-items: center; gap: 6px;
  padding: 7px 4px; border: none; background: transparent; cursor: pointer;
  min-width: 0; border-radius: 8px;
  transition: background 120ms;
}
.fp-group__toggle:hover { background: rgba(var(--v-theme-on-surface), .05); }

.fp-group__chevron {
  width: 12px; height: 12px; flex-shrink: 0;
  color: rgba(var(--v-theme-on-surface), .35);
  transition: transform 200ms cubic-bezier(.16,1,.3,1);
}
.fp-group__chevron--up { transform: rotate(0deg); }
/* default (collapsed) state points right */
.fp-group__chevron:not(.fp-group__chevron--up) { transform: rotate(-90deg); }

.fp-group__dot {
  width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0;
  box-shadow: 0 0 0 1.5px rgba(255,255,255,.3);
}
.fp-group__name {
  font-size: .8rem; font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  flex: 1; text-align: left;
}
.fp-group__rename-input {
  flex: 1; min-width: 0;
  font-size: .8rem; font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  background: rgba(var(--v-theme-primary), .07);
  border: 1.5px solid rgb(var(--v-theme-primary));
  border-radius: 5px;
  padding: 1px 6px; outline: none;
}
.fp-group__count {
  font-size: .67rem; font-weight: 700;
  color: rgba(var(--v-theme-on-surface), .32);
  flex-shrink: 0;
}

/* Actions — hidden until row is hovered */
.fp-group__actions {
  display: flex; align-items: center; gap: 1px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 150ms;
}
.fp-group__header:hover .fp-group__actions { opacity: 1; }

/* Colour dot inside the colour-picker button */
.fp-color-dot {
  width: 10px; height: 10px; border-radius: 50%;
  display: block;
}

/* Colour picker popover */
.fp-color-wrap { position: relative; }
.fp-color-picker {
  position: absolute; top: calc(100% + 4px); right: 0; z-index: 30;
  display: flex; gap: 5px; flex-wrap: wrap;
  width: 132px; padding: 8px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), .18);
  border-radius: 10px;
  box-shadow: 0 6px 22px rgba(0,0,0,.17);
}
.fp-swatch {
  width: 22px; height: 22px; border-radius: 50%;
  border: 2.5px solid transparent;
  cursor: pointer;
  transition: transform 130ms, border-color 130ms;
}
.fp-swatch:hover { transform: scale(1.14); }
.fp-swatch--active { border-color: rgba(var(--v-theme-on-surface), .65); transform: scale(1.12); }

/* Confirm-delete bar */
.fp-confirm-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px;
  background: rgba(var(--v-theme-error), .07);
  font-size: .73rem;
}
.fp-confirm-yes {
  padding: 2px 10px; border-radius: 6px; border: none;
  background: rgb(var(--v-theme-error)); color: #fff;
  font-size: .71rem; font-weight: 700; cursor: pointer;
}
.fp-confirm-yes:hover { opacity: .85; }
.fp-confirm-no {
  padding: 2px 10px; border-radius: 6px; border: none;
  background: rgba(var(--v-theme-on-surface), .09);
  color: rgb(var(--v-theme-on-surface));
  font-size: .71rem; cursor: pointer;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Stop list                                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */
.fp-stop-list { list-style: none; margin: 0; padding: 2px 0 4px; }
.fp-stop-list__empty {
  padding: 5px 18px 7px;
  font-size: .72rem; color: rgba(var(--v-theme-on-surface), .32);
  font-style: italic;
}
.fp-stop-row {
  display: flex; align-items: center; padding: 0 6px 0 18px;
  border-bottom: 1px solid rgba(var(--v-border-color),.05);
  transition: background 110ms;
}
.fp-stop-row:last-child { border-bottom: none; }
.fp-stop-row:hover { background: rgba(var(--v-theme-primary), .04); }

.fp-stop-row__btn {
  flex: 1; display: flex; align-items: center; gap: 7px;
  background: transparent; border: none; cursor: pointer;
  padding: 7px 4px 7px 0; text-align: left; min-width: 0;
}
.fp-stop-row__pin {
  width: 12px; height: 12px; flex-shrink: 0;
  color: rgba(var(--v-theme-primary), .6);
}
.fp-stop-row__name {
  font-size: .78rem; font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* Move menu */
.fp-move-wrap { position: relative; }
.fp-move-menu {
  position: absolute; top: calc(100% + 3px); right: 0; z-index: 30;
  min-width: 160px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color),.18);
  border-radius: 10px;
  padding: 6px 0;
  box-shadow: 0 6px 20px rgba(0,0,0,.15);
  overflow: hidden;
}
.fp-move-menu__label {
  font-size: .67rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
  color: rgba(var(--v-theme-on-surface), .38);
  padding: 0 12px 5px;
}
.fp-move-menu__item {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 7px 12px;
  background: transparent; border: none; cursor: pointer;
  font-size: .78rem; color: rgb(var(--v-theme-on-surface)); text-align: left;
  transition: background 110ms;
}
.fp-move-menu__item:hover { background: rgba(var(--v-theme-primary), .07); }
.fp-move-menu__dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

/* ─────────────────────────────────────────────────────────────────────────── */
/* Footer — add group                                                           */
/* ─────────────────────────────────────────────────────────────────────────── */
.fp-drawer__footer {
  flex-shrink: 0;
  border-top: 1px solid rgba(var(--v-border-color), .10);
  padding: 8px;
}
.fp-add-btn {
  display: flex; align-items: center; gap: 7px;
  width: 100%; padding: 8px 10px;
  background: rgba(var(--v-theme-primary), .06);
  border: 1.5px dashed rgba(var(--v-theme-primary), .32);
  border-radius: 9px;
  color: rgb(var(--v-theme-primary));
  font-size: .78rem; font-weight: 600;
  cursor: pointer;
  transition: background 140ms, border-color 140ms;
}
.fp-add-btn svg { width: 13px; height: 13px; }
.fp-add-btn:hover { background: rgba(var(--v-theme-primary), .11); border-color: rgba(var(--v-theme-primary), .5); }

.fp-add-form { display: flex; flex-direction: column; gap: 8px; }
.fp-add-input {
  width: 100%; padding: 7px 10px;
  border: 1.5px solid rgb(var(--v-theme-primary)); border-radius: 8px;
  background: rgba(var(--v-theme-primary), .05);
  color: rgb(var(--v-theme-on-surface));
  font-size: .8rem; outline: none;
}
.fp-add-colors { display: flex; gap: 6px; flex-wrap: wrap; padding: 0 1px; }
.fp-add-actions { display: flex; gap: 6px; }
.fp-add-confirm {
  flex: 1; padding: 6px; border-radius: 8px; border: none;
  background: rgb(var(--v-theme-primary)); color: #fff;
  font-size: .78rem; font-weight: 700; cursor: pointer;
}
.fp-add-confirm:hover { opacity: .88; }
.fp-add-cancel {
  flex: 1; padding: 6px; border-radius: 8px; border: none;
  background: rgba(var(--v-theme-on-surface), .08);
  color: rgb(var(--v-theme-on-surface));
  font-size: .78rem; cursor: pointer;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Empty state                                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */
.fp-empty {
  display: flex; flex-direction: column; align-items: center;
  padding: 40px 20px; text-align: center; gap: 10px;
}
.fp-empty__icon { width: 42px; height: 42px; color: rgba(var(--v-theme-on-surface), .16); }
.fp-empty p    { font-size: .8rem; color: rgba(var(--v-theme-on-surface), .5); margin: 0; }
.fp-empty small { font-size: .72rem; color: rgba(var(--v-theme-on-surface), .35); }

/* ─────────────────────────────────────────────────────────────────────────── */
/* Transitions                                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */
.drawer-enter-active { transition: transform 240ms cubic-bezier(.16,1,.3,1), opacity 180ms; }
.drawer-leave-active { transition: transform 180ms cubic-bezier(.4,0,1,1),  opacity 130ms; }
.drawer-enter-from, .drawer-leave-to { transform: translateX(-100%); opacity: 0; }

.backdrop-enter-active { transition: opacity 200ms; }
.backdrop-leave-active { transition: opacity 150ms; }
.backdrop-enter-from, .backdrop-leave-to { opacity: 0; }

.badge-enter-active { transition: transform 200ms cubic-bezier(.16,1,.3,1), opacity 160ms; }
.badge-leave-active { transition: transform 110ms, opacity 90ms; }
.badge-enter-from, .badge-leave-to { transform: scale(.3); opacity: 0; }

/* Group stop list collapse */
.collapse-enter-active { transition: max-height 220ms ease, opacity 180ms; }
.collapse-leave-active { transition: max-height 160ms ease, opacity 120ms; }
.collapse-enter-from, .collapse-leave-to { max-height: 0; opacity: 0; overflow: hidden; }
.collapse-enter-to, .collapse-leave-from { max-height: 600px; }

/* Confirm bar */
.confirm-enter-active { transition: max-height 180ms ease, opacity 150ms; }
.confirm-leave-active { transition: max-height 130ms ease, opacity 100ms; }
.confirm-enter-from, .confirm-leave-to { max-height: 0; opacity: 0; }
.confirm-enter-to, .confirm-leave-from { max-height: 60px; }

/* Add-group form */
.form-slide-enter-active { transition: max-height 200ms ease, opacity 160ms; }
.form-slide-leave-active { transition: max-height 140ms ease, opacity 110ms; }
.form-slide-enter-from, .form-slide-leave-to { max-height: 0; opacity: 0; overflow: hidden; }
.form-slide-enter-to, .form-slide-leave-from { max-height: 200px; }

/* ─────────────────────────────────────────────────────────────────────────── */
/* Mobile                                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */
@media (max-width: 600px) {
  .fp-trigger { top: 112px; }
  .fp-drawer  { width: min(280px, 85vw); top: 0; }
}
</style>
