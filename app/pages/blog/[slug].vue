<script setup lang="ts">
  import InfoTopNav from '~/components/ui/InfoTopNav.vue'
  import BlogSidebar from '~/components/blog/BlogSidebar.vue'
  import { SUPPORTED_LOCALES } from '~~/shared/types/locale'
  import type { BlogArticleResponse } from '~~/shared/types/blog'
  import { apiV1 } from '~/utils/api'

  const route = useRoute()

  // Admin draft preview (?preview=1): the flag is forwarded to the API,
  // which only honours it for a logged-in admin session.
  const isPreview = route.query.preview === '1'

  // One API call brings the article, its sections, its gallery and
  // the previous / next neighbours — all read from the database.
  const { data, error } = await useFetch<BlogArticleResponse>(
    apiV1(`/blog/${String(route.params.slug)}`),
    { query: isPreview ? { preview: '1' } : undefined },
  )

  if (error.value || !data.value) {
    throw createError({
      statusCode: error.value?.statusCode ?? 404,
      statusMessage: 'Article introuvable',
    })
  }

  const article = computed(() => data.value!.article)
  const previousArticle = computed(() => data.value!.previous)
  const nextArticle = computed(() => data.value!.next)

  // One shared formatter, reused for every date on the page.
  const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  /** "2026-07-10" → "10 juillet 2026". */
  function formatDate(iso: string): string {
    return dateFormatter.format(new Date(iso))
  }

  // Absolute origin for the canonical URL and social sharing tags:
  // always the canonical domain, even when visited through an alias.
  const siteOrigin = useRuntimeConfig().public.siteUrl || useRequestURL().origin

  // The hand-written SEO fields win when the admin filled them;
  // otherwise fall back to the article title / excerpt.
  const seoTitle = computed(() => article.value.seoTitle ?? `${article.value.title} — Blog Strasbourg Bus-Trams Live`)
  const seoDescription = computed(() => article.value.seoDescription ?? article.value.excerpt)

  useSeoMeta({
    title: () => seoTitle.value,
    description: () => seoDescription.value,
    ogTitle: () => article.value.seoTitle ?? article.value.title,
    ogDescription: () => seoDescription.value,
    ogImage: () => article.value.image,
    ogType: 'article',
    twitterCard: 'summary_large_image',
    // Preview pages must never be indexed.
    robots: () => (isPreview ? 'noindex, nofollow' : undefined),
  })

  // JSON-LD structured data — lets Google treat the page as an Article
  // rich result (headline, datePublished, image are the required trio).
  const jsonLd = computed(() => JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    'headline': article.value.title,
    'description': article.value.excerpt,
    'image': [article.value.image],
    'datePublished': article.value.date,
    'inLanguage': 'fr',
    'mainEntityOfPage': `${siteOrigin}/blog/${article.value.slug}`,
  }))

  const canonicalUrl = `${siteOrigin}/blog/${String(route.params.slug)}`

  // hreflang groundwork: one self-referencing tag per supported locale
  // (fr only today) + x-default. Adding a locale later is mechanical —
  // extend SUPPORTED_LOCALES, nothing to change here.
  // `as const` is required: unhead types `rel` as a literal union, and a
  // plain string inside .map() widens and no longer matches it.
  const alternateLinks = [...SUPPORTED_LOCALES, 'x-default'].map(hreflang => ({
    rel: 'alternate' as const,
    hreflang,
    href: canonicalUrl,
  }))

  useHead({
    link: [
      { rel: 'canonical' as const, href: canonicalUrl },
      ...alternateLinks,
    ],
    script: [{ type: 'application/ld+json', innerHTML: jsonLd }],
  })
</script>

<template>
  <div class="article-page">
    <InfoTopNav />

    <div class="article-page__layout mx-auto px-4 pt-4">
      <v-row density="comfortable">
        <!-- ── Left panel: recent + random articles (below the article on mobile) ── -->
        <v-col cols="12" md="4" order="2" order-md="1">
          <BlogSidebar :current-slug="article.slug" />
        </v-col>

        <!-- ── Main article ── -->
        <v-col cols="12" md="8" order="1" order-md="2">
          <v-alert
            v-if="isPreview"
            type="info"
            variant="tonal"
            density="compact"
            class="mb-4"
            text="Aperçu administrateur — cet article peut être un brouillon non publié."
          />
          <article>
            <!-- Main image of the place -->
            <v-img
              :src="article.image"
              :alt="article.title"
              aspect-ratio="16/9"
              cover
              rounded="xl"
              class="border"
            />

            <!-- Meta chips: category, date, reading time, stop + lines -->
            <div class="d-flex align-center flex-wrap ga-2 mt-4">
              <v-chip size="small" color="primary" variant="tonal" label>
                {{ article.category.name }}
              </v-chip>
              <v-chip size="small" variant="tonal" prepend-icon="mdi-calendar-outline">
                {{ formatDate(article.date) }}
              </v-chip>
              <v-chip size="small" variant="tonal" prepend-icon="mdi-clock-outline">
                {{ article.readingMinutes }} min
              </v-chip>
              <v-chip size="small" variant="tonal" prepend-icon="mdi-map-marker-outline">
                {{ article.nearestStop }} · {{ article.lines.join(' ') }}
              </v-chip>
            </div>

            <!-- Title + intro -->
            <h1 class="text-h5 font-weight-bold mt-3 mb-1">{{ article.title }}</h1>
            <p class="text-body-2 text-medium-emphasis">{{ article.excerpt }}</p>

            <!-- Content sections -->
            <section v-for="section in article.sections" :key="section.title" class="mt-6">
              <h2 class="text-subtitle-1 font-weight-bold mb-2">{{ section.title }}</h2>
              <p class="text-body-2 text-medium-emphasis">{{ section.text }}</p>
            </section>

            <!-- Images / videos slider.
                 Lazy hydration: the gallery code only loads and runs
                 once the section is scrolled into view. -->
            <section class="mt-6">
              <h2 class="text-subtitle-1 font-weight-bold mb-2">En images</h2>
              <LazyBlogMediaSlider hydrate-on-visible :items="article.gallery" />
            </section>

            <!-- Closing section under the slider -->
            <section class="mt-6">
              <h2 class="text-subtitle-1 font-weight-bold mb-2">{{ article.outro.title }}</h2>
              <p class="text-body-2 text-medium-emphasis">{{ article.outro.text }}</p>
            </section>

            <!-- ── Previous / next article ── -->
            <v-row tag="nav" aria-label="Autres articles" dense class="mt-5">
              <v-col cols="12" sm="6">
                <v-card
                  v-if="previousArticle"
                  :to="`/blog/${previousArticle.slug}`"
                  variant="outlined"
                  rounded="lg"
                  hover
                  class="pa-3 h-100"
                >
                  <p class="text-caption font-weight-bold text-primary d-flex align-center ga-1">
                    <v-icon icon="mdi-arrow-left" size="14" />
                    Article précédent
                  </p>
                  <p class="text-body-2 font-weight-medium mt-1">{{ previousArticle.title }}</p>
                </v-card>
              </v-col>
              <v-col cols="12" sm="6">
                <v-card
                  v-if="nextArticle"
                  :to="`/blog/${nextArticle.slug}`"
                  variant="outlined"
                  rounded="lg"
                  hover
                  class="pa-3 h-100 text-right"
                >
                  <p class="text-caption font-weight-bold text-primary d-flex align-center justify-end ga-1">
                    Article suivant
                    <v-icon icon="mdi-arrow-right" size="14" />
                  </p>
                  <p class="text-body-2 font-weight-medium mt-1">{{ nextArticle.title }}</p>
                </v-card>
              </v-col>
            </v-row>

            <v-btn
              to="/blog"
              variant="text"
              color="primary"
              size="small"
              prepend-icon="mdi-arrow-left"
              class="mt-4"
            >
              Tous les articles
            </v-btn>
          </article>
        </v-col>
      </v-row>
    </div>
  </div>
</template>

<style scoped>
/* Page scroll container + soft primary glow, same as InfoPageShell. */
.article-page {
  overflow-y: auto;
  overscroll-behavior-y: contain;
  padding-bottom: 25px;
  background:
    radial-gradient(circle at 50% -10%, rgba(var(--v-theme-primary), 0.055), transparent 30rem),
    rgb(var(--v-theme-background));
}

/* Wider than the editorial pages to fit the left panel. */
.article-page__layout {
  max-width: 1080px;
}
</style>
