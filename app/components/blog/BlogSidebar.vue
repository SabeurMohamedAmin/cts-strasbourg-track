<script setup lang="ts">
  /**
   * BlogSidebar — small panel shown next to an article:
   * the most recent articles, then a few random picks.
   * The list comes from GET /api/blog (Nuxt deduplicates the call
   * when another component already fetched the same URL).
   */
  import type { BlogArticleSummary } from '~~/shared/types/blog'

  const props = defineProps<{
    currentSlug: string
  }>()

  const { data: articles } = await useFetch<BlogArticleSummary[]>('/api/blog')

  /** Every article except the one currently displayed. */
  const others = computed(() =>
    (articles.value ?? []).filter(article => article.slug !== props.currentSlug),
  )

  /** The 4 most recent articles. */
  const recentArticles = computed(() =>
    [...others.value].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4),
  )

  // Random picks are computed on the client only (onMounted) so the
  // server and the client never render a different list (hydration).
  const randomArticles = ref<BlogArticleSummary[]>([])

  onMounted(() => {
    const pool = others.value.filter(article => !recentArticles.value.includes(article))
    randomArticles.value = [...pool].sort(() => Math.random() - 0.5).slice(0, 3)
  })
</script>

<template>
  <aside class="blog-sidebar d-flex flex-column ga-3">
    <!-- ── Recent articles ── -->
    <v-card rounded="xl" variant="outlined">
      <v-card-title class="text-subtitle-2 font-weight-bold d-flex align-center ga-2">
        <v-icon icon="mdi-clock-outline" size="18" />
        Articles récents
      </v-card-title>
      <v-list density="compact" bg-color="transparent" nav>
        <v-list-item
          v-for="item in recentArticles"
          :key="item.slug"
          :to="`/blog/${item.slug}`"
          :prepend-icon="item.category.icon"
          rounded="lg"
        >
          <v-list-item-title class="text-body-small">{{ item.title }}</v-list-item-title>
          <v-list-item-subtitle class="text-label-small">{{ item.category.name }}</v-list-item-subtitle>
        </v-list-item>
      </v-list>
    </v-card>

    <!-- ── Random picks (client only) ── -->
    <v-card v-if="randomArticles.length" rounded="xl" variant="outlined">
      <v-card-title class="text-subtitle-2 font-weight-bold d-flex align-center ga-2">
        <v-icon icon="mdi-shuffle-variant" size="18" />
        À découvrir
      </v-card-title>
      <v-list density="compact" bg-color="transparent" nav>
        <v-list-item
          v-for="item in randomArticles"
          :key="item.slug"
          :to="`/blog/${item.slug}`"
          :prepend-icon="item.category.icon"
          rounded="lg"
        >
          <v-list-item-title class="text-body-small">{{ item.title }}</v-list-item-title>
          <v-list-item-subtitle class="text-label-small">{{ item.category.name }}</v-list-item-subtitle>
        </v-list-item>
      </v-list>
    </v-card>
  </aside>
</template>

<style scoped>
/* Keep the panel visible while scrolling the article on desktop.
   Functional rule — Vuetify has no responsive sticky utility. */
@media (min-width: 960px) {
  .blog-sidebar {
    position: sticky;
    top: 52px;
  }
}
</style>
