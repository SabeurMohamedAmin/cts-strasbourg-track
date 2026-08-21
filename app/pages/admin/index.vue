<script setup lang="ts">
  import type { AdminStats } from '~~/shared/types/admin-blog'

  /**
   * /admin — dashboard: three counters and the last edited articles,
   * each linking to its editor page. Data comes from the cheap
   * GET /api/admin/stats endpoint.
   */
  definePageMeta({ layout: 'admin', middleware: 'admin' })

  useSeoMeta({
    title: 'Tableau de bord — Administration',
    robots: 'noindex, nofollow',
  })

  const { data: stats, pending } = await useFetch<AdminStats>('/api/admin/stats')

  const counters = computed(() => [
    { label: 'Articles', value: stats.value?.articleCount ?? 0, icon: 'mdi-post-outline', to: '/admin/articles' },
    { label: 'Brouillons', value: stats.value?.draftCount ?? 0, icon: 'mdi-pencil', to: '/admin/articles?status=draft' },
    { label: 'Catégories', value: stats.value?.categoryCount ?? 0, icon: 'mdi-shape-outline', to: '/admin/categories' },
  ])

  /** "26/07/2026 14:03" — compact French date for the list subtitle. */
  function formatDate(iso: string): string {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
  }
</script>

<template>
  <div>
    <AdminPageHeader
      title="Tableau de bord"
      subtitle="Vue d’ensemble du blog"
    />

    <v-row>
      <v-col v-for="counter in counters" :key="counter.label" cols="12" sm="4">
        <v-card :to="counter.to" class="glass-surface pa-2" rounded="xl" :loading="pending">
          <v-card-item>
            <template #prepend>
              <v-icon :icon="counter.icon" size="28" color="primary" />
            </template>
            <v-card-title class="text-h4 font-weight-bold">
              {{ counter.value }}
            </v-card-title>
            <v-card-subtitle>{{ counter.label }}</v-card-subtitle>
          </v-card-item>
        </v-card>
      </v-col>
    </v-row>

    <v-card class="glass-surface mt-6" rounded="xl">
      <v-card-title class="text-subtitle-1 font-weight-bold pa-4 pb-0">
        Dernières modifications
      </v-card-title>

      <v-list v-if="stats && stats.lastEdited.length > 0" bg-color="transparent" lines="two">
        <v-list-item
          v-for="article in stats.lastEdited"
          :key="article.slug"
          :to="`/admin/articles/${article.slug}`"
          :title="article.title"
          :subtitle="`Modifié le ${formatDate(article.updatedAt)}`"
          prepend-icon="mdi-file-document-outline"
          rounded="lg"
        >
          <template #append>
            <v-chip
              :color="article.status === 'published' ? 'success' : 'warning'"
              size="small"
              variant="tonal"
            >
              {{ article.status === 'published' ? 'Publié' : 'Brouillon' }}
            </v-chip>
          </template>
        </v-list-item>
      </v-list>

      <v-card-text v-else class="text-medium-emphasis">
        Aucun article pour le moment — créez le premier depuis la page Articles.
      </v-card-text>
    </v-card>
  </div>
</template>
