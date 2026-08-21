<script setup lang="ts">
  import InfoPageShell from '~/components/ui/InfoPageShell.vue'
  import BlogFilterBar from '~/components/blog/BlogFilterBar.vue'
  import BlogArticleCard from '~/components/blog/BlogArticleCard.vue'
  import { SORT_OPTIONS, type BlogArticleSummary, type BlogCategorySummary, type SortKey } from '~~/shared/types/blog'
  import { apiV1 } from '~/utils/api'

  /** Number of article cards shown per page. */
  const ARTICLES_PER_PAGE = 6

  // Articles come from the database through GET /api/v1/blog.
  const { data: articles } = await useFetch<BlogArticleSummary[]>(apiV1('/blog'))

  /** Fetched articles, or an empty list while unavailable. */
  const allArticles = computed(() => articles.value ?? [])

  /**
   * Categories are data-driven: one chip per distinct category found in
   * the fetched articles, ordered by the position set in the admin panel.
   * Empty categories simply never appear — no extra API call needed.
   */
  const categories = computed<BlogCategorySummary[]>(() => {
    const bySlug = new Map<string, BlogCategorySummary>()
    for (const article of allArticles.value) {
      if (!bySlug.has(article.category.slug)) bySlug.set(article.category.slug, article.category)
    }
    return [...bySlug.values()].sort((a, b) => a.position - b.position)
  })

  // ── Filters state, bound to the filter bar ──
  // The state is encoded in the URL (?q=…&categorie=…&tri=…&page=…) so a
  // filtered view can be shared or refreshed without losing anything.
  // vue-router already decodes the query values (%C3%A9 → é), we only
  // validate them before use and fall back to the defaults if invalid.
  const route = useRoute()

  /** Type guard: the query value is a known sort key. */
  function isSortKey(value: unknown): value is SortKey {
    return typeof value === 'string' && SORT_OPTIONS.some(option => option.value === value)
  }

  const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
  /** Selected category SLUG (stable, locale-independent), or null for all. */
  const category = ref<string | null>(typeof route.query.categorie === 'string' ? route.query.categorie : null)
  const sort = ref<SortKey>(isSortKey(route.query.tri) ? route.query.tri : 'recent')
  const page = ref(Math.max(1, Number(route.query.page) || 1))

  // Drop an unknown category slug coming from an old or edited URL.
  watch(categories, (list) => {
    if (category.value && !list.some(item => item.slug === category.value)) {
      category.value = null
    }
  }, { immediate: true })

  /** Articles matching the search text and the selected category, sorted. */
  const filteredArticles = computed(() => {
    const query = search.value?.trim().toLowerCase() ?? ''

    const matching = allArticles.value.filter((article) => {
      const matchesCategory = !category.value || article.category.slug === category.value
      const matchesSearch
        = query === ''
          || article.title.toLowerCase().includes(query)
          || article.excerpt.toLowerCase().includes(query)
          || article.nearestStop.toLowerCase().includes(query)
      return matchesCategory && matchesSearch
    })

    // `[...matching]` keeps the source array untouched before sorting.
    switch (sort.value) {
      case 'oldest':
        return [...matching].sort((a, b) => a.date.localeCompare(b.date))
      case 'title':
        return [...matching].sort((a, b) => a.title.localeCompare(b.title, 'fr'))
      case 'reading':
        return [...matching].sort((a, b) => a.readingMinutes - b.readingMinutes)
      default: // 'recent'
        return [...matching].sort((a, b) => b.date.localeCompare(a.date))
    }
  })

  const pageCount = computed(() =>
    Math.max(1, Math.ceil(filteredArticles.value.length / ARTICLES_PER_PAGE)),
  )

  /** Slice of the filtered list for the current page. */
  const pagedArticles = computed(() => {
    const start = (page.value - 1) * ARTICLES_PER_PAGE
    return filteredArticles.value.slice(start, start + ARTICLES_PER_PAGE)
  })

  // Go back to the first page whenever a filter changes.
  watch([search, category, sort], () => {
    page.value = 1
  })

  // Mirror the state into the URL. Default values are omitted so the URL
  // stays short (/blog instead of /blog?tri=recent&page=1).
  watch([search, category, sort, page], () => {
    const query: Record<string, string> = {}
    if (search.value?.trim()) query.q = search.value.trim()
    if (category.value) query.categorie = category.value
    if (sort.value !== 'recent') query.tri = sort.value
    if (page.value > 1) query.page = String(page.value)

    // `replace: true` avoids one history entry per keystroke.
    navigateTo({ query }, { replace: true })
  })

  // Canonical URL: always /blog on the canonical domain, without the
  // filter query string, so search engines index one single version.
  const siteOrigin = useRuntimeConfig().public.siteUrl || useRequestURL().origin

  useSeoMeta({
    title: 'Blog — Strasbourg Bus-Trams Live',
    description:
      'Stations de bus et tram, musées, bibliothèques et lieux à visiter autour du réseau de Strasbourg.',
    ogTitle: 'Blog — Strasbourg Bus-Trams Live',
    ogDescription: 'Stations de bus et tram, musées, bibliothèques et lieux à visiter autour du réseau de Strasbourg.',
    ogType: 'website',
  })

  useHead({
    link: [{ rel: 'canonical', href: `${siteOrigin}/blog` }],
  })
</script>

<template>
  <info-page-shell
    title="Blog"
    subtitle="Stations, musées et lieux à découvrir autour du réseau"
    icon="mdi-post-outline"
  >
    <!-- Search + category filter + sorting -->
    <blog-filter-bar
      v-model:search="search"
      v-model:category="category"
      v-model:sort="sort"
      :categories="categories"
    />

    <!-- Result count: instant feedback when filtering -->
    <p class="text-label-medium mb-4" aria-live="polite">
      {{ filteredArticles.length }} article{{ filteredArticles.length > 1 ? 's' : '' }}
    </p>

    <!-- Article cards, 2 per row from tablet up -->
    <v-row v-if="pagedArticles.length" density="comfortable">
      <v-col
        v-for="article in pagedArticles"
        :key="article.id"
        cols="12"
        sm="6"
      >
        <blog-article-card :article="article" />
      </v-col>
    </v-row>

    <!-- Empty state when no article matches the filters -->
    <v-empty-state
      v-else
      icon="mdi-text-box-search-outline"
      title="Aucun article trouvé"
      text="Essayez un autre mot-clé ou retirez le filtre de catégorie."
    />

    <!-- Pagination -->
    <v-pagination
      v-if="pageCount > 1"
      v-model="page"
      :length="pageCount"
      :total-visible="5"
      density="comfortable"
      class="mt-6"
      aria-label="Pages du blog"
    />
  </info-page-shell>
</template>
