<script setup lang="ts">
  /**
   * /admin/login — the only admin page reachable without a session
   * (besides the forgot/reset password pages).
   * The 'admin' middleware sends already-logged-in admins to the dashboard.
   */
  definePageMeta({ layout: false, middleware: 'admin' })

  useSeoMeta({
    title: 'Connexion — Administration',
    robots: 'noindex, nofollow',
  })

  const { fetch: refreshSession } = useUserSession()

  const username = ref('')
  const password = ref('')
  const showPassword = ref(false)
  const loading = ref(false)
  const errorMessage = ref('')

  async function submit() {
    if (username.value === '' || password.value === '' || loading.value) return

    loading.value = true
    errorMessage.value = ''

    try {
      await $fetch('/api/admin/login', {
        method: 'POST',
        body: { username: username.value, password: password.value },
      })
      // Sync the useUserSession() state with the fresh cookie,
      // then enter the admin area.
      await refreshSession()
      await navigateTo('/admin')
    }
    catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode
      errorMessage.value = statusCode === 429
        ? 'Trop de tentatives. Réessayez dans 15 minutes.'
        : 'Identifiants incorrects.'
    }
    finally {
      loading.value = false
    }
  }
</script>

<template>
  <v-app>
    <v-main class="admin-login">
      <div class="d-flex align-center justify-center fill-height pa-4">
        <v-card
          class="glass-surface glass-surface--strong pa-2"
          max-width="420"
          width="100%"
          rounded="xl"
        >
          <v-card-item>
            <template #prepend>
              <v-icon icon="mdi-shield-lock-outline" size="32" color="primary" />
            </template>
            <v-card-title>Administration</v-card-title>
            <v-card-subtitle>Espace réservé — connexion requise</v-card-subtitle>
          </v-card-item>

          <v-card-text>
            <v-form @submit.prevent="submit">
              <v-text-field
                v-model="username"
                label="Nom d’utilisateur"
                autocomplete="username"
                autofocus
                variant="outlined"
                class="mb-2"
              />

              <v-text-field
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                label="Mot de passe"
                autocomplete="current-password"
                variant="outlined"
                :error-messages="errorMessage"
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

              <v-btn
                type="submit"
                color="primary"
                size="large"
                class="mt-2"
                block
                :loading="loading"
                :disabled="username === '' || password === ''"
              >
                Se connecter
              </v-btn>

              <div class="text-center mt-4">
                <NuxtLink to="/admin/forgot-password" class="text-primary text-body-2">
                  Mot de passe oublié ?
                </NuxtLink>
              </div>
            </v-form>
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

/* Full-viewport centring with a soft brand gradient behind the glass card. */
.admin-login {
  min-height: 100dvh;
  background: linear-gradient(
    160deg,
    rgba(var(--v-theme-primary), 0.14),
    rgb(var(--v-theme-surface)) 55%
  );
}
</style>
