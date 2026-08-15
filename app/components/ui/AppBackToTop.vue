<script setup lang="ts">
// Floating "back to top" button.
//
// Why a capture-phase listener? The app shell (<v-main>) has
// `overflow: hidden`, so the window itself never scrolls: each page
// scrolls inside its own container. Scroll events do NOT bubble, but
// they CAN be captured on the document, so one listener sees every
// scrollable element in the app without hardcoding page class names.

const SCROLL_THRESHOLD = 200

const route = useRoute()
const isVisible = ref(false)

// The element the user scrolled last. This is the one we send back to top.
let scrolledElement: HTMLElement | null = null

function onScroll(event: Event) {
  if (event.target instanceof HTMLElement) {
    scrolledElement = event.target
    isVisible.value = event.target.scrollTop > SCROLL_THRESHOLD
  } else {
    // The document itself scrolled (window scrolling fallback).
    isVisible.value = window.scrollY > SCROLL_THRESHOLD
  }
}

onMounted(() => {
  document.addEventListener('scroll', onScroll, { capture: true, passive: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('scroll', onScroll, { capture: true })
})

// Pages are kept alive, each with its own scroll position:
// hide the button when navigating so it never shows on a fresh page.
watch(() => route.path, () => {
  isVisible.value = false
  scrolledElement = null
})

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
  scrolledElement?.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <v-scroll-y-transition>
    <v-fab
      v-if="isVisible"
      icon="mdi-chevron-up"
      size="x-small"
      class="back-to-top-btn"
      color="primary"
      variant="tonal"
      elevation="4"
      rounded="lg"
      aria-label="Retour en haut de la page"
      title="Retour en haut"
      @click="scrollToTop"
    />
  </v-scroll-y-transition>
</template>

<style scoped>
.back-to-top-btn {
  position: fixed;
  bottom: 85px;
  right: 42px;
  z-index: 9999;
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
}

@media (max-width: 600px) {
  .back-to-top-btn {
    bottom: 20px;
    right: 42px;
    width: 20px;
    height: 20px;
  }
}
</style>
