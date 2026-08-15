/**
 * Route guard for the /admin area.
 *
 * Every page under app/pages/admin/ declares it with:
 *   definePageMeta({ middleware: 'admin' })
 *
 * Behaviour:
 * - anonymous visitor on any /admin page  → redirected to /admin/login
 * - logged-in admin opening /admin/login  → redirected to the dashboard
 *
 * This is UX only — the real security lives server-side in
 * server/utils/require-admin.ts, which every admin endpoint calls.
 */
export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()

  if (to.path === '/admin/login') {
    if (loggedIn.value) return navigateTo('/admin')
    return
  }

  if (!loggedIn.value) return navigateTo('/admin/login')
})
