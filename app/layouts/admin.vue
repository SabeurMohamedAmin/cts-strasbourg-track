<script setup lang="ts">
  import { useAppTheme } from '~/composables/useAppTheme'
  /**
   * Admin chrome — own navigation, none of the public bottom nav.
   *
   * Left drawer: Tableau de bord, Articles, Catégories, → Voir le site.
   * Top bar: drawer toggle + logout button.
   * Pages opt in with definePageMeta({ layout: 'admin', middleware: 'admin' }).
   */
  
  const { fetch: refreshSession } = useUserSession()

  // Vuetify handles the mobile overlay behaviour; null = use defaults.
  const drawer = ref<boolean | null>(null)
  const loggingOut = ref(false)
  const logoutError = ref(false)

  const links = [
    { title: 'Tableau de bord', icon: 'mdi-view-dashboard-outline', to: '/admin', exact: true },
    { title: 'Articles', icon: 'mdi-post-outline', to: '/admin/articles', exact: false },
    { title: 'Catégories', icon: 'mdi-shape-outline', to: '/admin/categories', exact: false },
  ]

  async function logout() {
    loggingOut.value = true
    try {
      await $fetch('/api/admin/logout', { method: 'POST' })
      await refreshSession()
      await navigateTo('/admin/login')
    }
    catch {
      // No silent failures: tell the admin the logout did not go through.
      logoutError.value = true
    }
    finally {
      loggingOut.value = false
    }
  }

  const { isDark, toggleTheme, theme } = useAppTheme()

</script>

<template>
  <v-app :theme="theme">
    <v-app-bar density="compact" elevation="0" border="b">
      <v-app-bar-nav-icon size="small" class="border rounded-lg " aria-label="Ouvrir ou fermer la navigation" @click="drawer = !drawer" />
      <v-app-bar-title class="text-subtitle-1 font-weight-bold">
        Administration
      </v-app-bar-title>
      <v-spacer />
      <v-btn
        color="primary"
        variant="tonal"
        rounded="lg"
        class="mr-3"
        prepend-icon="mdi-logout"
        :loading="loggingOut"
        @click="logout"
      >
        Se déconnecter
      </v-btn>
    </v-app-bar>

    <v-navigation-drawer v-model="drawer" temporary class="admin-drawer">
      <v-list-item
        class="py-4"
        title="Administration"
        subtitle="Gestion du blog"
      >
      <template #append>
      <v-btn
      :icon="isDark ? 'mdi-white-balance-sunny' : 'mdi-moon-waning-crescent'"
      variant="plain"
      rounded="lg"
      size="x-small"
      class="icon-dark-mode cursor-pointer text-body-small"
      :class="{ 'icon-dark-mode--moon': !isDark }"
      :aria-label="isDark ? 'Activer le mode clair' : 'Activer le mode sombre'"
      @click="toggleTheme"
    />
        
      </template>
      </v-list-item>
      <v-divider />

      <v-list nav density="comfortable" aria-label="Navigation d’administration">
        <v-list-item
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          :exact="link.exact"
          :prepend-icon="link.icon"
          :title="link.title"
          rounded="lg"
        />
      </v-list>

      <template #append>
        <v-divider />
        <v-list nav density="comfortable" aria-label="Liens externes">
          <v-list-item
            href="/"
            target="_blank"
            prepend-icon="mdi-open-in-new"
            title="Voir le site"
            rounded="lg"
          />
        </v-list>
      </template>
    </v-navigation-drawer>

   
    <v-main>
      <v-container fluid class="pa-4 pa-md-6">
        <slot />
      </v-container>
    </v-main>

    <AdminSnackbar v-model="logoutError" text="La déconnexion a échoué. Réessayez." type="error" />
  </v-app>
</template>