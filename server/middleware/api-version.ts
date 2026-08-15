/**
 * API versioning alias (ROADMAP #12).
 *
 * Rewrites /api/v1/<endpoint> to the unversioned /api/<endpoint> handler,
 * so both paths serve the same frozen v1 contract (see docs/API.md).
 * The Flutter client should call /api/v1/… — if a breaking change is ever
 * needed, add real /api/v2/ handlers and keep this alias for v1 clients.
 *
 * The rewrite happens before route matching: server middleware runs first,
 * and h3 resolves the route from req.url afterwards.
 */
export default defineEventHandler((event) => {
  const url = event.node.req.url ?? ''
  if (url === '/api/v1' || url.startsWith('/api/v1/')) {
    // Replaces only the first occurrence — the prefix.
    event.node.req.url = url.replace('/api/v1', '/api')
  }
})
