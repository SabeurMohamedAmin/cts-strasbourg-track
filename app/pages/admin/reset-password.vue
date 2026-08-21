<script setup lang="ts">
  import { newPasswordSchema } from '~~/shared/schemas/admin-auth'

  /**
   * /admin/reset-password?token=… — choose a new password.
   *
   * Reachable WITHOUT a session (the visitor lost their password).
   * The token comes from the emailed link; it is single-use and
   * valid 24 hours. Success → back to the login page.
   */
  definePageMeta({ layout: false })

  useSeoMeta({
    title: 'Nouveau mot de passe — Administration',
    robots: 'noindex, nofollow',
  })

  const route = useRoute()
  const token = computed(() =>
    typeof route.query.token === 'string' ? route.query.token : '',
  )

  const newPassword = ref('')
  const confirmPassword = ref('')
  const showPassword = ref(false)
  const loading = ref(false)
  const done = ref(false)
  const errorMessage = ref('')

  async function submit() {
    if (loading.value) return

    // Same Zod rule as the server (12+ characters).
    const parsed = newPasswordSchema.safeParse(newPassword.value)
    if (!parsed.success) {
      errorMessage.value = parsed.error.issues[0]?.message ?? 'Mot de passe invalide'
      return
    }
    if (newPassword.value !== confirmPassword.value) {
      errorMessage.value = 'Les deux mots de passe ne correspondent pas.'
      return
    }

    loading.value = true
    errorMessage.value = ''

    try {
      await $fetch('/api/admin/password/reset', {
        method: 'POST',
        body: { token: token.value, newPassword: newPassword.value },
      })
      done.value = true
    }
    catch {
      errorMessage.value = 'Lien invalide ou expiré. Refaites une demande depuis « Mot de passe oublié ».'
    }
    finally {
      loading.value = false
    }
  }
</script>

<template>
  <v-app>
    <v-main class="admin-reset">
      <div class="d-flex align-center justify-center fill-height pa-4">
        <v-card
          class="glass-surface glass-surface--strong pa-2"
          max-width="420"
          width="100%"
          rounded="xl"
        >
          <v-card-item>
            <template #prepend>
              <v-icon icon="mdi-lock-reset" size="32" color="primary" />
            </template>
            <v-card-title>Nouveau mot de passe</v-card-title>
            <v-card-subtitle>Choisissez un mot de passe (12 caractères min.)</v-card-subtitle>
          </v-card-item>

          <v-card-text>
            <!-- The link was opened without its ?token= — nothing to do here. -->
            <v-alert
              v-if="token === ''"
              type="error"
              variant="tonal"
              text="Lien incomplet. Ouvrez le lien reçu par e-mail, ou refaites une demande."
            />

            <v-alert
              v-else-if="done"
              type="success"
              variant="tonal"
              text="Mot de passe modifié. Vous pouvez vous connecter."
            />

            <v-form v-else @submit.prevent="submit">
              <v-text-field
                v-model="newPassword"
                :type="showPassword ? 'text' : 'password'"
                label="Nouveau mot de passe"
                autocomplete="new-password"
                autofocus
                variant="outlined"
                class="mb-2"
              >
                <template #append-inner>
                  <!-- Real button: reachable with Tab, announced by readers. -->
                  <v-btn
                    :icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                    variant="text"
                    size="small"
                    :aria-label="showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
                    @click="showPassword = !showPassword"
                  />
                </template>
              </v-text-field>

              <v-text-field
                v-model="confirmPassword"
                :type="showPassword ? 'text' : 'password'"
                label="Confirmer le mot de passe"
                autocomplete="new-password"
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
                :disabled="newPassword === '' || confirmPassword === ''"
              >
                Changer le mot de passe
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
.admin-reset {
  min-height: 100dvh;
  background: linear-gradient(
    160deg,
    rgba(var(--v-theme-primary), 0.14),
    rgb(var(--v-theme-surface)) 55%
  );
}
</style>
