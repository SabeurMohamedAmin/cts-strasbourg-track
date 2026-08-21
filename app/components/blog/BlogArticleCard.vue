<script setup lang="ts">
  /**
   * BlogArticleCard — one article rendered as a Vuetify card:
   * icon banner, category chip, reading time, excerpt,
   * nearest stop with its line chips, and publication date.
   */
  import type { BlogArticleSummary } from '~~/shared/types/blog'

  defineProps<{
    article: BlogArticleSummary
  }>()

  // One shared formatter, reused for every render of the card.
  const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  /** "2026-07-10" → "10 juillet 2026". */
  function formatDate(iso: string): string {
    return dateFormatter.format(new Date(iso))
  }
</script>

<template>
  <!-- `variant="outlined"` + `hover` replace the old custom border,
       background and hover CSS with core Vuetify behaviour. -->
  <v-card class="h-100 d-flex flex-column" rounded="xl" variant="outlined" hover>
    <!-- Icon banner: lighter than an image, keeps the grid fast.
         The icon belongs to the category (data-driven, set in admin). -->
    <div class="article-card__banner" aria-hidden="true">
      <v-icon :icon="article.category.icon" size="42" />
    </div>

    <v-card-item class="pb-0">
      <div class="d-flex align-center justify-space-between mb-2">
        <v-chip size="x-small" color="primary" variant="tonal" label>
          {{ article.category.name }}
        </v-chip>
        <span class="text-label-small text-medium-emphasis d-flex align-center ga-1">
          <v-icon icon="mdi-clock-outline" size="12" />
          {{ article.readingMinutes }} min
        </span>
      </div>
      <!-- Vuetify typography classes use !important, so InfoPageShell's
           :deep(h2) styles cannot leak in. -->
      <h2 class="text-subtitle-1 font-weight-bold">{{ article.title }}</h2>
    </v-card-item>

    <v-card-text class="flex-grow-1 pt-2">
      <p class="text-body-small text-medium-emphasis mb-3">{{ article.excerpt }}</p>

      <!-- Where to get off + the lines serving the place -->
      <div class="d-flex align-center flex-wrap ga-1 text-label-small text-medium-emphasis">
        <v-icon icon="mdi-map-marker-outline" size="14" />
        <span class="mr-1">{{ article.nearestStop }}</span>
        <v-chip
          v-for="line in article.lines"
          :key="line"
          size="x-small"
          variant="outlined"
        >
          {{ line }}
        </v-chip>
      </div>
    </v-card-text>

    <v-divider />

    <v-card-actions class="px-4">
      <span class="text-label-small text-medium-emphasis">{{ formatDate(article.date) }}</span>
      <v-spacer />
      <v-btn
        :to="`/blog/${article.slug}`"
        color="primary"
        variant="text"
        size="small"
        append-icon="mdi-arrow-right"
      >
        Lire
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<style scoped>
/* Only the gradient banner needs custom CSS — no Vuetify equivalent. */
.article-card__banner {
  display: grid;
  height: 96px;
  place-items: center;
  background: linear-gradient(135deg, rgba(var(--v-theme-primary), 0.16), rgba(var(--v-theme-primary), 0.04));
  color: rgb(var(--v-theme-primary));
}
</style>
