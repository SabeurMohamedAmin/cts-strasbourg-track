<script setup lang="ts">
  import type { AdminArticleDetail, AdminArticleList, AdminArticleListItem, AdminCategorySummary } from '~~/shared/types/admin-blog'

  /**
   * /admin/articles — paginated article list.
   *
   * Filters (search, category, status) are sent to GET /api/admin/articles;
   * the server sorts by publication date, newest first. Row actions:
   * edit (→ /admin/articles/[slug]), duplicate (new draft with a
   * « -copie » slug suffix), delete (AdminConfirmDialog).
   */
  definePageMeta({ layout: 'admin', middleware: 'admin' })

  useSeoMeta({
    title: 'Articles — Administration',
    robots: 'noindex, nofollow',
  })

  const route = useRoute()

  // ── Filters (status can be preset from the dashboard: ?status=draft) ──────

  const search = ref('')
  const category = ref<string | null>(null)
  const status = ref<'draft' | 'published' | null>(
    route.query.status === 'draft' || route.query.status === 'published' ? route.query.status : null,
  )
  const page = ref(1)
  const perPage = 20

  // Any filter change goes back to page 1.
  watch([search, category, status], () => {
    page.value = 1
  })

  const query = computed(() => ({
    page: page.value,
    perPage,
    search: search.value || undefined,
    category: category.value ?? undefined,
    status: status.value ?? undefined,
  }))

  // useFetch re-runs automatically when the reactive query changes.
  const { data: list, pending, refresh } = await useFetch<AdminArticleList>('/api/admin/articles', { query })
  const { data: categories } = await useFetch<AdminCategorySummary[]>('/api/admin/categories')

  const categoryOptions = computed(() =>
    (categories.value ?? []).map(item => ({ title: item.name, value: item.slug })),
  )
  const statusOptions = [
    { title: 'Brouillon', value: 'draft' },
    { title: 'Publié', value: 'published' },
  ]

  // Sorting stays server-side (publishedAt desc) — headers are not sortable.
  const headers = [
    { title: 'Titre', key: 'title', sortable: false },
    { title: 'Catégorie', key: 'categoryName', sortable: false },
    { title: 'Statut', key: 'status', sortable: false },
    { title: 'Publication', key: 'publishedAt', sortable: false },
    { title: 'Lecture', key: 'readingMinutes', sortable: false, align: 'end' as const },
    { title: 'Actions', key: 'actions', sortable: false, align: 'end' as const },
  ]

  // ── Duplicate: full fetch → POST as a new draft with « -copie » slug ──────

  const duplicating = ref<string | null>(null)

  async function duplicate(item: AdminArticleListItem) {
    duplicating.value = item.slug
    try {
      const article = await $fetch<AdminArticleDetail>(`/api/admin/articles/${item.slug}`)
      await $fetch('/api/admin/articles', {
        method: 'POST',
        body: { ...article, slug: `${article.slug}-copie`, status: 'draft' },
      })
      notify('Brouillon dupliqué.')
      await refresh()
    }
    catch (error) {
      notify(errorText(error), 'error')
    }
    finally {
      duplicating.value = null
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  const deleteDialog = ref(false)
  const deleting = ref(false)
  const deleteTarget = ref<AdminArticleListItem | null>(null)

  function openDelete(item: AdminArticleListItem) {
    deleteTarget.value = item
    deleteDialog.value = true
  }

  async function confirmDelete() {
    if (!deleteTarget.value) return

    deleting.value = true
    try {
      await $fetch(`/api/admin/articles/${deleteTarget.value.slug}`, { method: 'DELETE' })
      notify('Article supprimé.')
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

  function errorText(error: unknown): string {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    return err.data?.statusMessage ?? err.statusMessage ?? 'Une erreur est survenue.'
  }

  /** "10/07/2026" — short French date for the table. */
  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR')
  }
</script>

<template>
  <div>
    <AdminPageHeader
      title="Articles"
      subtitle="Brouillons et articles publiés du blog"
    >
      <template #actions>
        <v-btn color="primary" rounded="lg" prepend-icon="mdi-plus" to="/admin/articles/new">
          Nouvel article
        </v-btn>
      </template>
    </AdminPageHeader>

    <v-card class="glass-surface mb-4 pa-4" rounded="xl">
      <v-row dense>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="search"
            label="Rechercher un titre…"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            density="comfortable"
            clearable
            hide-details
          />
        </v-col>
        <v-col cols="6" md="3">
          <v-select
            v-model="category"
            :items="categoryOptions"
            label="Catégorie"
            variant="outlined"
            density="comfortable"
            clearable
            hide-details
          />
        </v-col>
        <v-col cols="6" md="3">
          <v-select
            v-model="status"
            :items="statusOptions"
            label="Statut"
            variant="outlined"
            density="comfortable"
            clearable
            hide-details
          />
        </v-col>
      </v-row>
    </v-card>

    <v-card class="glass-surface" rounded="xl">
      <v-data-table-server
        v-model:page="page"
        :headers="headers"
        :items="list?.items ?? []"
        :items-length="list?.total ?? 0"
        :items-per-page="perPage"
        :loading="pending"
        item-value="slug"
        no-data-text="Aucun article ne correspond aux filtres."
      >
        <template #item.title="{ item }">
          <NuxtLink :to="`/admin/articles/${item.slug}`" class="text-primary font-weight-medium text-decoration-none">
            {{ item.title }}
          </NuxtLink>
        </template>

        <template #item.status="{ item }">
          <v-chip
            :color="item.status === 'published' ? 'success' : 'warning'"
            size="small"
            variant="tonal"
          >
            {{ item.status === 'published' ? 'Publié' : 'Brouillon' }}
          </v-chip>
        </template>

        <template #item.publishedAt="{ item }">
          {{ formatDate(item.publishedAt) }}
        </template>

        <template #item.readingMinutes="{ item }">
          {{ item.readingMinutes }} min
        </template>

        <template #item.actions="{ item }">
          <v-btn
            icon="mdi-pencil"
            variant="text"
            size="small"
            :aria-label="`Modifier ${item.title}`"
            :to="`/admin/articles/${item.slug}`"
          />
          <v-btn
            icon="mdi-content-copy"
            variant="text"
            size="small"
            :aria-label="`Dupliquer ${item.title}`"
            :loading="duplicating === item.slug"
            @click="duplicate(item)"
          />
          <v-btn
            icon="mdi-delete-outline"
            variant="text"
            size="small"
            color="error"
            :aria-label="`Supprimer ${item.title}`"
            @click="openDelete(item)"
          />
        </template>
      </v-data-table-server>
    </v-card>

    <AdminConfirmDialog
      v-model="deleteDialog"
      :title="`Supprimer « ${deleteTarget?.title ?? ''} » ?`"
      message="L’article, ses sections et sa galerie seront définitivement supprimés. Cette action est irréversible."
      confirm-label="Supprimer l’article"
      :loading="deleting"
      @confirm="confirmDelete"
    />

    <AdminSnackbar v-model="snackbar.visible" :text="snackbar.text" :type="snackbar.type" />
  </div>
</template>
