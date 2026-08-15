/**
 * useAppTheme (Step 4.1)
 *
 * SSR-safe light/dark theme for the whole app, persisted in a cookie.
 * Exposes { theme, isDark, toggleTheme }.
 *
 * WHY useCookie instead of localStorage + onMounted:
 *
 * Nuxt SSR renders the full HTML on the server. If the server uses
 * theme='light' but the client corrects it in onMounted, Vue's hydration
 * check sees a class mismatch (v-theme--dark vs v-theme--light on the
 * same node) and warns. In production this means a flash of wrong theme
 * and console noise.
 *
 * useCookie() is read on BOTH server and client before rendering, so
 * the SSR HTML and the hydrated vnode tree always agree.
 *
 * First visit (no cookie): the cookie is undefined, so we fall back to
 * the OS prefers-color-scheme hint, write it to the cookie immediately,
 * and SSR the correct theme from that point on.
 */

export type AppTheme = 'light' | 'dark'

export function useAppTheme() {
  const themeCookie = useCookie<AppTheme>('cts-theme', {
    default: () => 'light',   // SSR-safe fallback; overridden below on first visit
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
  })

  // On first client visit (no cookie stored yet), honour the OS setting.
  if (import.meta.client && !document.cookie.includes('cts-theme')) {
    themeCookie.value = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }

  const theme = computed<AppTheme>({
    get: () => themeCookie.value ?? 'light',
    set: (v) => { themeCookie.value = v },
  })

  /** Convenience flag for components that only need a boolean. */
  const isDark = computed(() => theme.value === 'dark')

  function toggleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  return { theme, isDark, toggleTheme }
}
