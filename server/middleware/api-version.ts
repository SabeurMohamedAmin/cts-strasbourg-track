/**
 * API version guard (ROADMAP #12, ROADMAP_NITRO_API 2.4).
 *
 * The /api/v1/<endpoint> → /api/<endpoint> aliasing itself is done by a route
 * rule in nuxt.config.ts ('/api/v1/**': { proxy: '/api/**' }). A URL rewrite
 * here does NOT work: Nitro's route matcher ignores a path rewritten from
 * middleware, which made every /api/v1/* request 404.
 *
 * What stays here, because only middleware runs before routing:
 *
 * SECURITY: the public v1 surface is ONLY the endpoints listed in
 * ROADMAP_NITRO_API 1.3. The admin area must never be reachable through the
 * versioned prefix, so /api/v1/admin/** is rejected with 404 before anything
 * can route it — otherwise the alias would expose /api/admin/* publicly.
 *
 * Plus the X-API-Version tag so request logs can split v1 traffic from
 * legacy unversioned calls during the FLUTTER 1.8 migration.
 */
export default defineEventHandler((event) => {
  const url = event.node.req.url ?? ''
  if (url !== '/api/v1' && !url.startsWith('/api/v1/') && !url.startsWith('/api/v1?')) {
    return
  }

  const isAdminPath = url === '/api/v1/admin'
    || url.startsWith('/api/v1/admin/')
    || url.startsWith('/api/v1/admin?')
  if (isAdminPath) {
    // 404 (not 401/403): do not confirm the private surface exists.
    throw createError({ statusCode: 404, message: 'Not Found' })
  }

  // Routing is handled by the route rule; only the tag is ours to set.
  setResponseHeader(event, 'X-API-Version', '1')
})
