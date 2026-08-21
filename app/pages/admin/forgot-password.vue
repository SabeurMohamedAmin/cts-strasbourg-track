<script setup lang="ts">
  import { forgotPasswordSchema } from '~~/shared/schemas/admin-auth'

  /**
   * /admin/forgot-password — request a reset link by email.
   *
   * Reachable WITHOUT a session (no 'admin' middleware on purpose).
   * The API always answers the same generic message, so this page never
   * reveals whether an address is allowlisted.
   */
  definePageMeta({ layout: false })

  useSeoMeta({
    title: 'Mot de passe oublié — Administration',
    robots: 'noindex, nofollow',
  })

  const email = ref('')
  const loading = ref(false)
  const sent = ref(false)
  const errorMessage = ref('')

  async function submit() {
    if (loading.value) return

    // Same Zod rule as the server — catch typos before the round-trip.
    const parsed = forgotPasswordSchema.safeParse({ email: email.value })
    if (!parsed.success) {
      errorMessage.value = parsed.error.issues[0]?.message ?? 'Adresse e-mail invalide'
      return
    }

    loading.value = true
    errorMessage.value = ''

    try {
      await $fetch('/api/admin/password/forgot', {
        method: 'POST',
        body: parsed.data,
      })
      sent.value = true
    }
    catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode
      errorMessage.value = statusCode === 429
        ? 'Trop de demandes. Réessayez dans 15 minutes.'
        : 'Une erreur est survenue. Réessayez.'
    }
    finally {
      loading.value = false
    }
  }
</script>

<template>
  <v-app>
    <v-main class="admin-forgot">
      <div class="d-flex align-center justify-center fill-height pa-4">
        <v-card
          class="glass-surface glass-surface--strong pa-2"
          max-width="420"
          width="100%"
          rounded="xl"
        >
          <v-card-item>
            <template #prepend>
              <v-icon icon="mdi-email-lock-outline" size="32" color="primary" />
            </template>
            <v-card-title>Mot de passe oublié</v-card-title>
            <v-card-subtitle>Recevez un lien de réinitialisation</v-card-subtitle>
          </v-card-item>

          <v-card-text>
            <!-- Generic on purpose: never reveals if the address is known. -->
            <v-alert
              v-if="sent"
              type="success"
              variant="tonal"
              class="mb-4"
              text="Si cette adresse est autorisée, un e-mail de réinitialisation a été envoyé. Le lien est valable 24 heures."
            />

            <v-form v-if="!sent" @submit.prevent="submit">
              <v-text-field
                v-model="email"
                type="email"
                label="Adresse e-mail"
                autocomplete="email"
                autofocus
                variant="outlined"
                :error-messages="errorMessage"
              />

              <v-btn
                type="submit"
                color="primary"
                size="large"
                class="mt-2"
                block
                :loading="loading"
                :disabled="email === ''"
              >
                Envoyer le lien
              </v-btn>
            </v-form>

            <div class="text-center mt-4">
              <NuxtLink to="/admin/login" class="text-primary text-body-2">
                Retour à la connexion
              </NuxtLink>
            </div>
          </v-card-text>
        </v-card>
      </div>
    </v-main>
  </v-app>
</template>

<style scoped>
/* Visible focus ring for keyboard users (same rule as the admin layout). */
:deep(:is(a, button, input, textarea, [tabindex]):focus-visible) {
  outline: 3px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

/* Same backdrop as the login page — the two screens feel like one flow. */
.admin-forgot {
  min-height: 100dvh;
  background: linear-gradient(
    160deg,
    rgba(var(--v-theme-primary), 0.14),
    rgb(var(--v-theme-surface)) 55%
  );
}
</style>
