<script setup lang="ts">
  /**
   * BlogMediaSlider — gallery built with Vuetify core components only:
   *   - v-carousel shows the full-size images / YouTube videos
   *   - v-slide-group below shows the clickable thumbnails
   *
   * Both share the same `current` index, so they stay in sync without
   * any external slider library (Swiper was removed for performance).
   *
   * Each slide is a `BlogMedia`: type 'image' (src = image URL),
   * 'youtube' or 'vimeo' (src = bare video ID).
   */
  import type { BlogMedia } from '~~/shared/types/blog'

  const props = defineProps<{
    items: BlogMedia[]
  }>()

  /** Index of the visible slide, shared by the carousel and the thumbnails. */
  const current = ref(0)

  /** Privacy-friendly embed URL built from a YouTube video ID. */
  function youtubeEmbedUrl(videoId: string): string {
    return `https://www.youtube-nocookie.com/embed/${videoId}`
  }

  /** Vimeo embed — dnt=1 disables the player's tracking (privacy). */
  function vimeoEmbedUrl(videoId: string): string {
    return `https://player.vimeo.com/video/${videoId}?dnt=1`
  }

  /** Thumbnail of a slide: the image itself, or the video preview image. */
  function thumbnailUrl(item: BlogMedia): string {
    if (item.type === 'youtube') return `https://i.ytimg.com/vi/${item.src}/hqdefault.jpg`
    // Vimeo thumbnails need an API call — vumbnail.com proxies it for free.
    if (item.type === 'vimeo') return `https://vumbnail.com/${item.src}.jpg`
    return item.src
  }
</script>

<template>
  <div>
    <!-- ── Main slider ── -->
    <v-carousel
      v-model="current"
      height="320"
      hide-delimiters
      show-arrows="hover"
      class="rounded-xl border"
    >
      <v-carousel-item v-for="(item, index) in props.items" :key="index">
        <v-img
          v-if="item.type === 'image'"
          :src="item.src"
          :alt="item.alt ?? ''"
          height="100%"
          cover
        />
        <iframe
          v-else-if="item.type === 'youtube'"
          :src="youtubeEmbedUrl(item.src)"
          class="w-100 h-100 border-0"
          title="Vidéo YouTube"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          loading="lazy"
        />
        <iframe
          v-else
          :src="vimeoEmbedUrl(item.src)"
          class="w-100 h-100 border-0"
          title="Vidéo Vimeo"
          allow="autoplay; fullscreen; picture-in-picture"
          allowfullscreen
          loading="lazy"
        />
      </v-carousel-item>
    </v-carousel>

    <!-- ── Thumbnail strip ── -->
    <v-slide-group
      v-model="current"
      class="mt-2"
      center-active
      mandatory
      show-arrows
    >
      <v-slide-group-item
        v-for="(item, index) in props.items"
        :key="index"
        v-slot="{ isSelected, toggle }"
        :value="index"
      >
        <v-card
          width="88"
          height="56"
          rounded="lg"
          variant="flat"
          class="me-2 border-md border-primary"
          :class="isSelected ? 'border-opacity-100' : 'border-opacity-0 opacity-60'"
          :aria-label="`Média ${index + 1}`"
          @click="toggle"
        >
          <v-img :src="thumbnailUrl(item)" :alt="item.alt ?? ''" height="100%" cover>
            <!-- Small play badge on video thumbnails -->
            <div v-if="item.type !== 'image'" class="thumb-play d-flex align-center justify-center fill-height">
              <v-icon icon="mdi-play" size="16" color="white" />
            </div>
          </v-img>
        </v-card>
      </v-slide-group-item>
    </v-slide-group>
  </div>
</template>

<style scoped>
/* Dark scrim behind the play icon on video thumbnails. */
.thumb-play {
  background: rgba(0, 0, 0, 0.35);
}
</style>
