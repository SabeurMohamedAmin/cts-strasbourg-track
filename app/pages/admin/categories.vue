<script setup lang="ts">
  import { mdiIconPaths } from '~/utils/mdi-icons'
  import { categoryCreateSchema, slugifyTitle } from '~~/shared/schemas/admin-blog'
  import type { AdminCategorySummary } from '~~/shared/types/admin-blog'

  /**
   * /admin/categories — CRUD of the blog categories.
   *
   * - table: name, icon preview, article count, position,
   * - create / edit in one v-dialog form (slug auto-generated from the
   *   fr name until edited by hand, icon picker fed by the mdi catalog),
   * - delete via AdminConfirmDialog; when articles still use the
   *   category, a « reassign to… » select unlocks the deletion.
   * Every mutation ends with refresh() + a snackbar — no silent failures.
   */
  definePageMeta({ layout: 'admin', middleware: 'admin' })

  useSeoMeta({
    title: 'Catégories — Administration',
    robots: 'noindex, nofollow',
  })

  const { data: categories, pending, refresh } = await useFetch<AdminCategorySummary[]>('/api/admin/categories')

  const headers = [
    { title: 'Nom', key: 'name' },
    { title: 'Icône', key: 'icon', sortable: false },
    { title: 'Articles', key: 'articleCount', align: 'end' as const },
    { title: 'Position', key: 'position', align: 'end' as const },
    { title: 'Actions', key: 'actions', sortable: false, align: 'end' as const },
  ]

  /** Only icons registered in the catalog can be picked (icon rule). */
  const iconOptions = Object.keys(mdiIconPaths).sort()

  // ── Create / edit dialog (both modes share the same form) ───────────────

  const dialog = ref(false)
  const saving = ref(false)
  /** Slug of the category being edited — null while creating. */
  const editedSlug = ref<string | null>(null)
  const slugTouched = ref(false)
  const formError = ref('')
  const form = reactive({ name: '', slug: '', icon: 'mdi-post-outline', position: 0 })

  // Auto-generate the slug from the name until it is edited by hand
  // (creation only — an existing slug never changes silently).
  watch(() => form.name, (name) => {
    if (editedSlug.value === null && !slugTouched.value) form.slug = slugifyTitle(name)
  })

  function openCreate() {
    editedSlug.value = null
    slugTouched.value = false
    formError.value = ''
    Object.assign(form, { name: '', slug: '', icon: 'mdi-post-outline', position: categories.value?.length ?? 0 })
    dialog.value = true
  }

  function openEdit(category: AdminCategorySummary) {
    editedSlug.value = category.slug
    slugTouched.value = true
    formError.value = ''
    Object.assign(form, { name: category.name, slug: category.slug, icon: category.icon, position: category.position })
    dialog.value = true
  }

  async function save() {
    const payload = {
      slug: form.slug,
      icon: form.icon,
      position: Number(form.position),
      translations: [{ locale: 'fr' as const, name: form.name.trim() }],
    }

    // Same Zod schema as the API — instant feedback, no request wasted.
    const parsed = categoryCreateSchema.safeParse(payload)
    if (!parsed.success) {
      formError.value = parsed.error.issues[0]?.message ?? 'Formulaire invalide'
      return
    }

    saving.value = true
    formError.value = ''
    try {
      if (editedSlug.value === null) {
        await $fetch('/api/admin/categories', { method: 'POST', body: parsed.data })
        notify('Catégorie créée.')
      }
      else {
        await $fetch(`/api/admin/categories/${editedSlug.value}`, { method: 'PATCH', body: parsed.data })
        notify('Catégorie mise à jour.')
      }
      dialog.value = false
      await refresh()
    }
    catch (error) {
      formError.value = errorText(error)
    }
    finally {
      saving.value = false
    }
  }

  // ── Delete dialog (blocked while articles use the category) ──────────────

  const deleteDialog = ref(false)
  const deleting = ref(false)
  const deleteTarget = ref<AdminCategorySummary | null>(null)
  const reassignTo = ref<string | null>(null)

  const deleteBlocked = computed(() => (deleteTarget.value?.articleCount ?? 0) > 0)

  const reassignOptions = computed(() =>
    (categories.value ?? [])
      .filter(category => category.slug !== deleteTarget.value?.slug)
      .map(category => ({ title: category.name, value: category.slug })),
  )

  function openDelete(category: AdminCategorySummary) {
    deleteTarget.value = category
    reassignTo.value = null
    deleteDialog.value = true
  }

  async function confirmDelete() {
    if (!deleteTarget.value) return

    deleting.value = true
    try {
      await $fetch(`/api/admin/categories/${deleteTarget.value.slug}`, {
        method: 'DELETE',
        query: reassignTo.value ? { reassignTo: reassignTo.value } : undefined,
      })
      notify('Catégorie supprimée.')
      deleteDialog.value = false
      await refresh()
    }
    catch (error) {
      notify(errorText(error), 'error')
    }
    finally {
      deleting.value = false
    }
  }

  // ── Feedback ──────────────────────────────────────────────────────────────

  const snackbar = reactive({ visible: false, text: '', type: 'success' as 'success' | 'error' })

  function notify(text: string, type: 'success' | 'error' = 'success') {
    Object.assign(snackbar, { visible: true, text, type })
  }

  /** Human message from an H3 error (statusMessage set by the API). */
  function errorText(error: unknown): string {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    return err.data?.statusMessage ?? err.statusMessage ?? 'Une erreur est survenue.'
  }
</script>

<template>
  <div>
    <AdminPageHeader
      title="Catégories"
      subtitle="Organisent les articles du blog et alimentent la barre de filtres"
    >
      <template #actions>
        <v-btn color="primary" rounded="lg" prepend-icon="mdi-plus" @click="openCreate">
          Nouvelle catégorie
        </v-btn>
      </template>
    </AdminPageHeader>

    <v-card class="glass-surface" rounded="xl">
      <v-data-table
        :headers="headers"
        :items="categories ?? []"
        :loading="pending"
        item-value="slug"
        :sort-by="[{ key: 'position', order: 'asc' }]"
        no-data-text="Aucune catégorie — créez la première."
      >
        <template #item.icon="{ item }">
          <v-icon :icon="item.icon" :aria-label="item.icon" />
        </template>

        <template #item.actions="{ item }">
          <v-btn
            icon="mdi-pencil"
            variant="text"
            size="small"
            :aria-label="`Modifier ${item.name}`"
            @click="openEdit(item)"
          />
          <v-btn
            icon="mdi-delete-outline"
            variant="text"
            size="small"
            color="error"
            :aria-label="`Supprimer ${item.name}`"
            @click="openDelete(item)"
          />
        </template>
      </v-data-table>
    </v-card>

    <!-- Create / edit form -->
    <v-dialog v-model="dialog" max-width="480" :z-index="2600">
      <v-card rounded="xl" class="pa-2">
        <v-card-title class="pa-4 pb-0">
          {{ editedSlug === null ? 'Nouvelle catégorie' : 'Modifier la catégorie' }}
        </v-card-title>

        <v-card-text>
          <v-form @submit.prevent="save">
            <v-text-field
              v-model="form.name"
              label="Nom (fr)"
              variant="outlined"
              autofocus
              class="mb-2"
            />
            <v-text-field
              v-model="form.slug"
              label="Slug"
              variant="outlined"
              hint="Utilisé dans les URL de filtres — minuscules, chiffres, tirets"
              persistent-hint
              class="mb-2"
              @update:model-value="slugTouched = true"
            />
            <v-select
              v-model="form.icon"
              :items="iconOptions"
              label="Icône"
              variant="outlined"
              class="mb-2"
            >
              <template #selection="{ item }">
                <v-icon :icon="item" class="mr-2" />
                {{ item }}
              </template>
              <template #item="{ props: itemProps, item }">
                <v-list-item v-bind="itemProps" :prepend-icon="item" />
              </template>
            </v-select>
            <v-text-field
              v-model.number="form.position"
              label="Position"
              type="number"
              min="0"
              variant="outlined"
              hint="Ordre dans la barre de filtres (0 = première)"
              persistent-hint
            />

            <v-alert v-if="formError" type="error" variant="tonal" density="compact" class="mt-3">
              {{ formError }}
            </v-alert>
          </v-form>
        </v-card-text>

        <v-card-actions class="justify-end pa-4 pt-0">
          <v-btn variant="text" rounded="lg" @click="dialog = false">
            Annuler
          </v-btn>
          <v-btn color="primary" variant="flat" rounded="lg" :loading="saving" @click="save">
            Enregistrer
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete confirmation, with reassign select when blocked -->
    <AdminConfirmDialog
      v-model="deleteDialog"
      :title="`Supprimer « ${deleteTarget?.name ?? ''} » ?`"
      :message="deleteBlocked
        ? `${deleteTarget?.articleCount} article(s) utilisent encore cette catégorie. Choisissez où les réaffecter avant de supprimer.`
        : 'Cette catégorie sera définitivement supprimée. Cette action est irréversible.'"
      confirm-label="Supprimer la catégorie"
      :loading="deleting"
      :confirm-disabled="deleteBlocked && reassignTo === null"
      @confirm="confirmDelete"
    >
      <v-select
        v-if="deleteBlocked"
        v-model="reassignTo"
        :items="reassignOptions"
        label="Réaffecter les articles à…"
        variant="outlined"
        density="comfortable"
        hide-details
        class="mt-4"
      />
    </AdminConfirmDialog>

    <AdminSnackbar v-model="snackbar.visible" :text="snackbar.text" :type="snackbar.type" />
  </div>
</template>
