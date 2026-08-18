/**
 * API versioning alias (ROADMAP #12, ROADMAP_NITRO_API 2.4).
 *
 * Rewrites /api/v1/<endpoint> to the unversioned /api/<endpoint> handler,
 * so both paths serve the same frozen v1 contract (see docs/API.md).
 * The Flutter client should call /api/v1/… — if a breaking change is ever
 * needed, add real /api/v2/ handlers and keep this alias for v1 clients.
 *
 * The rewrite happens before route matching: server middleware runs first,
 * and h3 resolves the route from req.url afterwards.
 *
 * SECURITY: the public v1 surface is ONLY the endpoints listed in
 * ROADMAP_NITRO_API 1.3. The admin area must never be reachable through
 * the versioned prefix, so /api/v1/admin/** is rejected with 404 BEFORE
 * the rewrite — otherwise the alias would silently expose /api/admin/*
 * under the public contract.
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

  // Replaces only the first occurrence — the prefix.
  const rewritten = url.replace('/api/v1', '/api')

  // Update BOTH the node request url and h3's own path cache. `event.path`
  // reads `_path` before falling back to node.req.url, so rewriting the url
  // alone can leave the router matching /api/v1/... — which has no handler
  // and 404s. h3's own useBase() sets the two together for this reason.
  event.node.req.url = rewritten
  event._path = rewritten
  // Tag versioned traffic so request logs can split v1 (mobile/web-v1)
  // from legacy unversioned calls during the FLUTTER 1.8 migration.
  setResponseHeader(event, 'X-API-Version', '1')
})
