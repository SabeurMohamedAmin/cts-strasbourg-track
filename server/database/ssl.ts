import { readFileSync } from 'node:fs'

/**
 * Shared PostgreSQL SSL resolution, most secure option first:
 * 1. NUXT_DATABASE_SSL=false            → no TLS (local Postgres only)
 * 2. NUXT_DATABASE_SSL_CA=path/to.crt   → verify against the provider CA
 *    (Supabase → Project Settings → Database → SSL → download certificate)
 * 3. NUXT_DATABASE_SSL_REJECT_UNAUTHORIZED=false → TLS without verification
 *    (last resort for self-signed chains — prefer option 2)
 * 4. Default → TLS with full certificate verification
 *
 * Note: node-postgres IGNORES `?sslmode=...` in the connection string when an
 * explicit `ssl` option is passed to the Pool. The env vars above are the
 * single source of truth for every connection in this project.
 */
export function resolveSsl(): false | { ca?: string, rejectUnauthorized?: boolean } {
  if (process.env.NUXT_DATABASE_SSL === 'false') return false

  const caPath = process.env.NUXT_DATABASE_SSL_CA
  if (caPath) {
    return { ca: readFileSync(caPath, 'utf8') }
  }

  return { rejectUnauthorized: process.env.NUXT_DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
}
