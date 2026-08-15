<script setup lang="ts">
  import {
    ALLOWED_IMAGE_HOSTS,
    articleCreateSchema,
    isAllowedImageUrl,
    parseVimeoId,
    parseYoutubeId,
    slugifyTitle,
  } from '~~/shared/schemas/admin-blog'
  import type { AdminArticleDetail, AdminCategorySummary } from '~~/shared/types/admin-blog'

  /** Media types a gallery row can take. */
  type MediaType = 'image' | 'youtube' | 'vimeo'

  /**
   * /admin/articles/[slug] — the article editor (Phase 6 core).
   *
   * Creation uses the reserved path /admin/articles/new ('new' is a
   * forbidden slug value); any other value loads that article. Every
   * human-readable field writes into the single `fr` translation — the
   * payload shape is already multilingual, so a locale tab switcher is
   * a later drop-in. Client-side validation runs the exact same Zod
   * schema as the API: instant feedback, no request wasted.
   */
  definePageMeta({ layout: 'admin', middleware: 'admin' })

  useSeoMeta({
    title: 'Éditeur d’article — Administration',
    robots: 'noindex, nofollow',
  })

  const route = useRoute()

  /** Slug in the URL — 'new' means creation mode (reserved slug). */
  const routeSlug = String(route.params.slug)
  const isNew = routeSlug === 'new'

  const { data: categories } = await useFetch<AdminCategorySummary[]>('/api/admin/categories')

  const categoryOptions = computed(() =>
    (categories.value ?? []).map(item => ({ title: item.name, value: item.slug })),
  )

  // ── Form state ────────────────────────────────────────────────────────────
  // Flat fields are easier to v-model; buildPayload() maps them back to
  // the API shape (translations array + gallery) on save.

  const form = reactive({
    slug: '',
    categorySlug: null as string | null,
    publishedAt: new Date().toISOString().slice(0, 10),
    readingMinutes: 3,
    heroImageUrl: '',
    lines: [] as string[],
    nearestStop: '',
    // fr translation
    title: '',
    excerpt: '',
    seoTitle: '',
    seoDescription: '',
    sections: [] as { title: string, body: string }[],
    gallery: [] as { type: MediaType, src: string, alt: string }[],
    outroTitle: '',
    outroText: '',
  })

  /** Status stored in DB — drives the slug lock and the button labels. */
  const savedStatus = ref<'draft' | 'published'>('draft')
  const isPublished = computed(() => savedStatus.value === 'published')

  if (!isNew) {
    const { data: article, error } = await useFetch<AdminArticleDetail>(`/api/admin/articles/${routeSlug}`)
    if (error.value || !article.value) {
      throw createError({ statusCode: error.value?.statusCode ?? 404, statusMessage: 'Article introuvable' })
    }

    const fr = article.value.translations.find(translation => translation.locale === 'fr')
    savedStatus.value = article.value.status
    Object.assign(form, {
      slug: article.value.slug,
      categorySlug: article.value.categorySlug,
      publishedAt: article.value.publishedAt,
      readingMinutes: article.value.readingMinutes,
      heroImageUrl: article.value.heroImageUrl,
      lines: [...article.value.lines],
      nearestStop: article.value.nearestStop,
      title: fr?.title ?? '',
      excerpt: fr?.excerpt ?? '',
      seoTitle: fr?.seoTitle ?? '',
      seoDescription: fr?.seoDescription ?? '',
      sections: (fr?.sections ?? []).map(section => ({ ...section })),
      gallery: article.value.gallery.map(media => ({ type: media.type, src: media.src, alt: media.alt ?? '' })),
      outroTitle: fr?.outroTitle ?? '',
      outroText: fr?.outroText ?? '',
    })
  }

  // ── Slug ──────────────────────────────────────────────────────────────────
  // Auto-generated from the title until edited by hand (creation only),
  // still editable while draft, read-only once published — a published
  // slug is a public URL, changing it would break SEO.

  const slugTouched = ref(!isNew)

  watch(() => form.title, (title) => {
    if (!slugTouched.value) form.slug = slugifyTitle(title)
  })

  // ── Previews (hero image + Google-style SEO snippet) ─────────────────────

  const heroPreview = computed(() => (isAllowedImageUrl(form.heroImageUrl) ? form.heroImageUrl : null))

  const siteOrigin = useRuntimeConfig().public.siteUrl || useRequestURL().origin
  const snippetUrl = computed(() => `${siteOrigin}/blog/${form.slug || 'slug-de-l-article'}`)
  const snippetTitle = computed(() => form.seoTitle || form.title || 'Titre de l’article')
  const snippetDescription = computed(
    () => form.seoDescription || form.excerpt || 'Description affichée dans les résultats de recherche.',
  )

  // ── Repeatable rows: sections & gallery ───────────────────────────────────

  /** Moves a row up (delta -1) or down (+1) — v1 reorder, no drag lib. */
  function move<T>(list: T[], index: number, delta: -1 | 1): void {
    const target = index + delta
    if (target < 0 || target >= list.length) return
    const [row] = list.splice(index, 1)
    list.splice(target, 0, row!)
  }

  function addSection(): void {
    form.sections.push({ title: '', body: '' })
  }

  function addMedia(): void {
    form.gallery.push({ type: 'image', src: '', alt: '' })
  }

  const mediaTypeOptions = [
    { title: 'Image', value: 'image' },
    { title: 'YouTube', value: 'youtube' },
    { title: 'Vimeo', value: 'vimeo' },
  ]

  /** Client-side mirror of the API media allowlist — same shared helpers. */
  function mediaSrcError(media: { type: MediaType, src: string }): string[] {
    if (!media.src) return []
    if (media.type === 'image' && !isAllowedImageUrl(media.src)) {
      return [`URL https requise sur un domaine autorisé : ${ALLOWED_IMAGE_HOSTS.join(', ')}`]
    }
    if (media.type === 'youtube' && parseYoutubeId(media.src) === null) {
      return ['Identifiant ou URL YouTube invalide']
    }
    if (media.type === 'vimeo' && parseVimeoId(media.src) === null) {
      return ['Identifiant ou URL Vimeo invalide']
    }
    return []
  }

  /** Thumbnail of a media row — video thumbs derive from the video id. */
  function mediaThumb(media: { type: MediaType, src: string }): string | null {
    if (media.type === 'image') return isAllowedImageUrl(media.src) ? media.src : null
    if (media.type === 'youtube') {
      const id = parseYoutubeId(media.src)
      return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null
    }
    // Vimeo thumbnails need an API call — vumbnail.com proxies it for free.
    const id = parseVimeoId(media.src)
    return id ? `https://vumbnail.com/${id}.jpg` : null
  }

  // ── Cloudinary uploads ──────────────────────────────────────────────
  // The browser never talks to Cloudinary directly: local files and
  // remote URLs go through POST /api/admin/media/upload, which signs
  // the request server-side and returns the res.cloudinary.com URL.

  /** Target currently uploading: 'hero' or a gallery row index. */
  const uploading = ref<'hero' | number | null>(null)

  /** Opens the file picker, then uploads the chosen image. */
  function pickFile(target: 'hero' | number): void {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const body = new FormData()
      body.append('file', file)
      uploadTo(target, body)
    }
    input.click()
  }

  /** Sends the URL already typed in the field to Cloudinary (remote fetch). */
  function importUrl(target: 'hero' | number): void {
    const url = (target === 'hero' ? form.heroImageUrl : form.gallery[target]!.src).trim()
    if (url === '') return
    uploadTo(target, { url })
  }

  async function uploadTo(target: 'hero' | number, body: FormData | { url: string }): Promise<void> {
    uploading.value = target
    try {
      const { url } = await $fetch<{ url: string }>('/api/admin/media/upload', { method: 'POST', body })
      if (target === 'hero') form.heroImageUrl = url
      else form.gallery[target]!.src = url
      notify('Image hébergée sur Cloudinary.')
    }
    catch (error) {
      notify(errorText(error), 'error')
    }
    finally {
      uploading.value = null
    }
  }

  // ── Save: draft or publish ────────────────────────────────────────────────

  const saving = ref<'draft' | 'published' | null>(null)
  const formError = ref('')

  /** Maps the flat form back to the API payload (fr translation only). */
  function buildPayload(status: 'draft' | 'published') {
    return {
      slug: form.slug,
      categorySlug: form.categorySlug ?? '',
      status,
      publishedAt: form.publishedAt,
      readingMinutes: Number(form.readingMinutes),
      heroImageUrl: form.heroImageUrl.trim(),
      lines: form.lines.map(line => line.trim().toUpperCase()).filter(line => line !== ''),
      nearestStop: form.nearestStop.trim(),
      translations: [{
        locale: 'fr' as const,
        title: form.title.trim(),
        excerpt: form.excerpt.trim(),
        seoTitle: form.seoTitle.trim() || null,
        seoDescription: form.seoDescription.trim() || null,
        outroTitle: form.outroTitle.trim(),
        outroText: form.outroText.trim(),
        sections: form.sections.map(section => ({ title: section.title.trim(), body: section.body.trim() })),
      }],
      gallery: form.gallery.map(media => ({ type: media.type, src: media.src.trim(), alt: media.alt.trim() || null })),
    }
  }

  async function save(status: 'draft' | 'published'): Promise<void> {
    if (!form.categorySlug) {
      formError.value = 'Choisissez une catégorie.'
      return
    }

    // Same Zod schema as the API — instant feedback, no request wasted.
    const parsed = articleCreateSchema.safeParse(buildPayload(status))
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      formError.value = issue ? `${issue.path.join(' › ')} — ${issue.message}` : 'Formulaire invalide'
      return
    }

    saving.value = status
    formError.value = ''
    try {
      if (isNew) {
        await $fetch('/api/admin/articles', { method: 'POST', body: parsed.data })
        // Freshly saved: let the redirect to the real URL through the guard.
        leaveConfirmed = true
        // Leave the reserved /new URL for the real editor URL.
        await navigateTo(`/admin/articles/${parsed.data.slug}`, { replace: true })
        return
      }

      await $fetch(`/api/admin/articles/${routeSlug}`, { method: 'PATCH', body: parsed.data })
      savedStatus.value = status
      // The form now matches the DB — refresh the « clean » snapshot.
      savedSnapshot.value = JSON.stringify(buildPayload(savedStatus.value))
      notify(status === 'published' ? 'Article publié.' : 'Brouillon enregistré.')
      if (parsed.data.slug !== routeSlug) {
        // Draft renamed: follow the article to its new URL.
        await navigateTo(`/admin/articles/${parsed.data.slug}`, { replace: true })
      }
    }
    catch (error) {
      formError.value = errorText(error)
      notify(formError.value, 'error')
    }
    finally {
      saving.value = null
    }
  }

  // ── Preview ───────────────────────────────────────────────────────────────

  /**
   * Opens the public page in a new tab. ?preview=1 lets the API serve
   * drafts to the admin session — anonymous visitors never see them.
   * Only the last saved version is shown, hence the disabled state on /new.
   */
  function openPreview(): void {
    window.open(`/blog/${routeSlug}?preview=1`, '_blank', 'noopener')
  }

  // ── Unsaved-changes guard ──────────────────────────────────────────────────
  // Dirty = the payload the form would send differs from the last saved
  // one. JSON snapshots keep the comparison simple and reliable.

  const savedSnapshot = ref(JSON.stringify(buildPayload(savedStatus.value)))

  const hasUnsavedChanges = computed(
    () => JSON.stringify(buildPayload(savedStatus.value)) !== savedSnapshot.value,
  )

  const leaveDialog = ref(false)
  /** Destination kept aside while the confirm dialog is open. */
  const pendingLeavePath = ref<string | null>(null)
  /** True once the user confirmed — lets the next navigation through. */
  let leaveConfirmed = false

  onBeforeRouteLeave((to) => {
    if (leaveConfirmed || !hasUnsavedChanges.value) return true
    pendingLeavePath.value = to.fullPath
    leaveDialog.value = true
    return false
  })

  function confirmLeave(): void {
    leaveConfirmed = true
    leaveDialog.value = false
    if (pendingLeavePath.value) navigateTo(pendingLeavePath.value)
  }

  // ── Feedback ──────────────────────────────────────────────────────────────

  const snackbar = reactive({ visible: false, text: '', type: 'success' as 'success' | 'error' })

  function notify(text: string, type: 'success' | 'error' = 'success'): void {
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
      :title="isNew ? 'Nouvel article' : (form.title || 'Article sans titre')"
      :subtitle="isNew ? 'Rédigez, puis enregistrez en brouillon ou publiez' : `Slug : ${routeSlug}`"
    >
      <template #actions>
        <v-chip :color="isPublished ? 'success' : 'warning'" size="small" variant="tonal">
          {{ isPublished ? 'Publié' : 'Brouillon' }}
        </v-chip>
        <v-btn
          variant="text"
          rounded="lg"
          prepend-icon="mdi-eye-outline"
          :disabled="isNew"
          @click="openPreview"
        >
          Aperçu
        </v-btn>
        <v-btn
          variant="tonal"
          rounded="lg"
          prepend-icon="mdi-content-save-outline"
          :loading="saving === 'draft'"
          :disabled="saving === 'published'"
          @click="save('draft')"
        >
          {{ isPublished ? 'Repasser en brouillon' : 'Enregistrer en brouillon' }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          rounded="lg"
          prepend-icon="mdi-publish"
          :loading="saving === 'published'"
          :disabled="saving === 'draft'"
          @click="save('published')"
        >
          {{ isPublished ? 'Mettre à jour' : 'Publier' }}
        </v-btn>
      </template>
    </AdminPageHeader>

    <v-alert v-if="formError" type="error" variant="tonal" density="compact" class="mb-4">
      {{ formError }}
    </v-alert>

    <!-- ── Méta ── -->
    <v-card class="glass-surface mb-4 pa-4" rounded="xl">
      <h2 class="text-subtitle-1 font-weight-bold mb-3">Méta</h2>
      <v-row dense>
        <v-col cols="12" md="8">
          <v-text-field
            v-model="form.title"
            label="Titre (fr)"
            counter="160"
            variant="outlined"
            :autofocus="isNew"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-select
            v-model="form.categorySlug"
            :items="categoryOptions"
            label="Catégorie"
            variant="outlined"
          />
        </v-col>

        <v-col cols="12" md="8">
          <!-- Editable while draft, locked chip once published (public URL). -->
          <template v-if="isPublished">
            <p class="text-caption text-medium-emphasis mb-1">Slug (verrouillé après publication)</p>
            <v-chip prepend-icon="mdi-lock-outline" variant="tonal" label>
              {{ form.slug }}
            </v-chip>
          </template>
          <v-text-field
            v-else
            v-model="form.slug"
            label="Slug"
            variant="outlined"
            hint="URL publique /blog/[slug] — modifiable tant que l’article est en brouillon"
            persistent-hint
            @update:model-value="slugTouched = true"
          />
        </v-col>
        <v-col cols="6" md="2">
          <v-text-field
            v-model="form.publishedAt"
            label="Date de publication"
            type="date"
            variant="outlined"
          />
        </v-col>
        <v-col cols="6" md="2">
          <v-text-field
            v-model.number="form.readingMinutes"
            label="Lecture (min)"
            type="number"
            min="1"
            max="120"
            variant="outlined"
          />
        </v-col>

        <v-col cols="12">
          <v-textarea
            v-model="form.excerpt"
            label="Extrait"
            counter="300"
            rows="2"
            auto-grow
            variant="outlined"
          />
        </v-col>

        <v-col cols="12" md="6">
          <v-combobox
            v-model="form.lines"
            label="Lignes desservantes (ex. A, D)"
            multiple
            chips
            closable-chips
            variant="outlined"
            hint="Tapez la ligne puis Entrée"
            persistent-hint
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="form.nearestStop"
            label="Arrêt le plus proche"
            variant="outlined"
          />
        </v-col>

        <v-col cols="12" :md="heroPreview ? 8 : 12">
          <v-text-field
            v-model="form.heroImageUrl"
            label="Image principale (URL)"
            variant="outlined"
            :hint="`Domaines autorisés : ${ALLOWED_IMAGE_HOSTS.join(', ')} — envoyez un fichier ou importez une URL vers Cloudinary`"
            persistent-hint
          >
            <template #append>
              <v-btn
                icon="mdi-cloud-upload"
                variant="tonal"
                size="small"
                :loading="uploading === 'hero'"
                aria-label="Envoyer une image depuis cet appareil"
                @click="pickFile('hero')"
              />
              <v-btn
                icon="mdi-cloud-download-outline"
                variant="tonal"
                size="small"
                class="ms-1"
                :loading="uploading === 'hero'"
                :disabled="!form.heroImageUrl || isAllowedImageUrl(form.heroImageUrl)"
                aria-label="Importer cette URL vers Cloudinary"
                @click="importUrl('hero')"
              />
            </template>
          </v-text-field>
        </v-col>
        <v-col v-if="heroPreview" cols="12" md="4">
          <v-img
            :src="heroPreview"
            alt="Aperçu de l’image principale"
            aspect-ratio="16/9"
            cover
            rounded="lg"
            class="border"
          />
        </v-col>
      </v-row>
    </v-card>

    <!-- ── SEO ── -->
    <v-card class="glass-surface mb-4 pa-4" rounded="xl">
      <h2 class="text-subtitle-1 font-weight-bold mb-3">SEO</h2>
      <v-row dense>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="form.seoTitle"
            label="Titre SEO"
            counter="60"
            variant="outlined"
            hint="Vide = titre de l’article"
            persistent-hint
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-textarea
            v-model="form.seoDescription"
            label="Description SEO"
            counter="160"
            rows="2"
            auto-grow
            variant="outlined"
            hint="Vide = extrait"
            persistent-hint
          />
        </v-col>
        <v-col cols="12">
          <!-- Google-style snippet preview -->
          <div class="seo-snippet pa-4 rounded-lg" aria-label="Aperçu du résultat Google">
            <p class="seo-snippet__url mb-1">{{ snippetUrl }}</p>
            <p class="seo-snippet__title mb-1">{{ snippetTitle }}</p>
            <p class="seo-snippet__description mb-0">{{ snippetDescription }}</p>
          </div>
        </v-col>
      </v-row>
    </v-card>

    <!-- ── Sections ── -->
    <v-card class="glass-surface mb-4 pa-4" rounded="xl">
      <div class="d-flex align-center justify-space-between mb-3">
        <h2 class="text-subtitle-1 font-weight-bold">Sections</h2>
        <v-btn
          variant="tonal"
          rounded="lg"
          size="small"
          prepend-icon="mdi-plus"
          :disabled="form.sections.length >= 20"
          @click="addSection"
        >
          Ajouter une section
        </v-btn>
      </div>

      <p v-if="form.sections.length === 0" class="text-body-2 text-medium-emphasis mb-0">
        Aucune section — ajoutez le premier bloc de contenu.
      </p>

      <div v-for="(section, index) in form.sections" :key="index" class="d-flex ga-3 mb-4">
        <div class="d-flex flex-column">
          <v-btn
            icon="mdi-arrow-up"
            variant="text"
            size="small"
            :disabled="index === 0"
            :aria-label="`Monter la section ${index + 1}`"
            @click="move(form.sections, index, -1)"
          />
          <v-btn
            icon="mdi-arrow-down"
            variant="text"
            size="small"
            :disabled="index === form.sections.length - 1"
            :aria-label="`Descendre la section ${index + 1}`"
            @click="move(form.sections, index, 1)"
          />
          <v-btn
            icon="mdi-delete-outline"
            variant="text"
            size="small"
            color="error"
            :aria-label="`Supprimer la section ${index + 1}`"
            @click="form.sections.splice(index, 1)"
          />
        </div>
        <div class="flex-grow-1">
          <v-text-field
            v-model="section.title"
            :label="`Titre de la section ${index + 1}`"
            counter="160"
            variant="outlined"
            density="comfortable"
            class="mb-1"
          />
          <v-textarea
            v-model="section.body"
            label="Texte"
            rows="3"
            auto-grow
            variant="outlined"
            density="comfortable"
            hide-details
          />
        </div>
      </div>
    </v-card>

    <!-- ── Galerie ── -->
    <v-card class="glass-surface mb-4 pa-4" rounded="xl">
      <div class="d-flex align-center justify-space-between mb-3">
        <h2 class="text-subtitle-1 font-weight-bold">Galerie</h2>
        <v-btn
          variant="tonal"
          rounded="lg"
          size="small"
          prepend-icon="mdi-plus"
          :disabled="form.gallery.length >= 12"
          @click="addMedia"
        >
          Ajouter un média
        </v-btn>
      </div>

      <p v-if="form.gallery.length === 0" class="text-body-2 text-medium-emphasis mb-0">
        Aucun média — images (Cloudinary ou domaines autorisés), vidéos YouTube ou Vimeo.
      </p>

      <div v-for="(media, index) in form.gallery" :key="index" class="d-flex ga-3 mb-4">
        <div class="d-flex flex-column">
          <v-btn
            icon="mdi-arrow-up"
            variant="text"
            size="small"
            :disabled="index === 0"
            :aria-label="`Monter le média ${index + 1}`"
            @click="move(form.gallery, index, -1)"
          />
          <v-btn
            icon="mdi-arrow-down"
            variant="text"
            size="small"
            :disabled="index === form.gallery.length - 1"
            :aria-label="`Descendre le média ${index + 1}`"
            @click="move(form.gallery, index, 1)"
          />
          <v-btn
            icon="mdi-delete-outline"
            variant="text"
            size="small"
            color="error"
            :aria-label="`Supprimer le média ${index + 1}`"
            @click="form.gallery.splice(index, 1)"
          />
        </div>

        <v-row dense class="flex-grow-1">
          <v-col cols="12" sm="3">
            <v-select
              v-model="media.type"
              :items="mediaTypeOptions"
              label="Type"
              variant="outlined"
              density="comfortable"
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="5">
            <v-text-field
              v-model="media.src"
              :label="media.type === 'image' ? 'URL de l’image'
                : media.type === 'youtube' ? 'URL ou identifiant YouTube' : 'URL ou identifiant Vimeo'"
              variant="outlined"
              density="comfortable"
              :error-messages="mediaSrcError(media)"
            >
              <template v-if="media.type === 'image'" #append>
                <v-btn
                  icon="mdi-cloud-upload"
                  variant="tonal"
                  size="small"
                  :loading="uploading === index"
                  :aria-label="`Envoyer une image depuis cet appareil pour le média ${index + 1}`"
                  @click="pickFile(index)"
                />
                <v-btn
                  icon="mdi-cloud-download-outline"
                  variant="tonal"
                  size="small"
                  class="ms-1"
                  :loading="uploading === index"
                  :disabled="!media.src || isAllowedImageUrl(media.src)"
                  :aria-label="`Importer cette URL vers Cloudinary pour le média ${index + 1}`"
                  @click="importUrl(index)"
                />
              </template>
            </v-text-field>
          </v-col>
          <v-col cols="12" sm="4">
            <v-text-field
              v-model="media.alt"
              label="Texte alternatif"
              counter="200"
              variant="outlined"
              density="comfortable"
            />
          </v-col>
        </v-row>

        <v-img
          v-if="mediaThumb(media)"
          :src="mediaThumb(media)!"
          :alt="media.alt || 'Aperçu du média'"
          cover
          rounded="lg"
          class="media-thumb border flex-shrink-0"
        />
      </div>
    </v-card>

    <!-- ── Outro ── -->
    <v-card class="glass-surface mb-4 pa-4" rounded="xl">
      <h2 class="text-subtitle-1 font-weight-bold mb-3">Outro</h2>
      <v-text-field
        v-model="form.outroTitle"
        label="Titre de l’outro"
        counter="160"
        variant="outlined"
        class="mb-1"
      />
      <v-textarea
        v-model="form.outroText"
        label="Texte de l’outro"
        rows="3"
        auto-grow
        variant="outlined"
        hide-details
      />
    </v-card>

    <!-- Bottom actions: same as the header, avoids scrolling back up. -->
    <div class="d-flex flex-wrap justify-end ga-2 mb-8">
      <v-btn
        variant="tonal"
        rounded="lg"
        prepend-icon="mdi-content-save-outline"
        :loading="saving === 'draft'"
        :disabled="saving === 'published'"
        @click="save('draft')"
      >
        {{ isPublished ? 'Repasser en brouillon' : 'Enregistrer en brouillon' }}
      </v-btn>
      <v-btn
        color="primary"
        variant="flat"
        rounded="lg"
        prepend-icon="mdi-publish"
        :loading="saving === 'published'"
        :disabled="saving === 'draft'"
        @click="save('published')"
      >
        {{ isPublished ? 'Mettre à jour' : 'Publier' }}
      </v-btn>
    </div>

    <!-- Unsaved-changes guard -->
    <AdminConfirmDialog
      v-model="leaveDialog"
      title="Quitter sans enregistrer ?"
      message="Vos modifications non enregistrées seront perdues. Cette action est irréversible."
      confirm-label="Quitter la page"
      @confirm="confirmLeave"
    />

    <AdminSnackbar v-model="snackbar.visible" :text="snackbar.text" :type="snackbar.type" />
  </div>
</template>

<style scoped>
/* Google-style result preview — theme-aware, readable in both modes. */
.seo-snippet {
  max-width: 600px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.seo-snippet__url {
  font-size: 0.8rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  overflow-wrap: anywhere;
}

.seo-snippet__title {
  font-size: 1.15rem;
  line-height: 1.3;
  color: rgb(var(--v-theme-primary));
}

.seo-snippet__description {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.75);
}

/* Fixed 16:9 thumbnail next to each gallery row. */
.media-thumb {
  width: 112px;
  height: 63px;
}
</style>
