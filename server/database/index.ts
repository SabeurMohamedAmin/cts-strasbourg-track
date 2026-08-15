import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { resolveSsl } from './ssl'
import * as stopsSchema from './schema/stops'
import * as routesSchema from './schema/routes'
import * as shapesSchema from './schema/shapes'
import * as tripsSchema from './schema/trips'
import * as stopTimesSchema from './schema/stop_times'
import * as calendarSchema from './schema/calendar'
import * as blogSchema from './schema/blog'

/**
 * useRuntimeConfig() is only available inside Nitro event handlers.
 * NUXT_DATABASE_URL is also used by Drizzle Kit and GTFS import scripts,
 * so we read process.env directly here.
 *
 * Lazy initialisation (serverless-safe):
 *   This module used to read NUXT_DATABASE_URL and `throw` at import time.
 *   On serverless hosts (e.g. Netlify Functions) a missing or misconfigured
 *   env var then crashed the whole function bundle, so EVERY /api/* request
 *   returned an opaque 500 — even endpoints that could degrade gracefully.
 *
 *   The connection pool is now created on the FIRST query instead:
 *   the server always boots, and each endpoint can catch the error and
 *   answer with a clear, actionable message.
 */

const schema = {
  ...stopsSchema,
  ...routesSchema,
  ...shapesSchema,
  ...tripsSchema,
  ...stopTimesSchema,
  ...calendarSchema,
  ...blogSchema,
}

function createDb() {
  const databaseUrl = process.env.NUXT_DATABASE_URL

  if (!databaseUrl) {
    throw new Error(
      'Missing NUXT_DATABASE_URL. '
      + 'Locally: copy .env.example to .env and configure PostgreSQL. '
      + 'On Netlify: add it under Site configuration → Environment variables.',
    )
  }

  /**
   * Pool sizing — tuned for Supabase's Supavisor pooler.
   *
   * The SESSION pooler (port 5432) caps concurrent clients at `pool_size`
   * (15 on the free tier). Every process gets its own pg.Pool: the local
   * dev server, each Netlify function instance, drizzle-kit, import
   * scripts… With pg's default max of 10 per pool, two processes are
   * enough to exhaust the cap and every request fails with EMAXCONNSESSION.
   *
   * Defaults below keep each process small and release slots fast:
   * - max: 4 connections per process (override with NUXT_DATABASE_POOL_MAX;
   *   set it to 1 or 2 on serverless hosts)
   * - idleTimeoutMillis: idle connections are closed after 5 s
   * - allowExitOnIdle: a finished process (script, lambda) frees its slots
   *   immediately instead of holding them until the runtime is recycled
   * - connectionTimeoutMillis: fail fast instead of hanging when the
   *   pooler is saturated
   *
   * Tip: the TRANSACTION pooler (port 6543) multiplexes statements over a
   * shared server pool and tolerates many more clients — prefer it when
   * deploying to serverless.
   */
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: resolveSsl(),
    max: Number(process.env.NUXT_DATABASE_POOL_MAX ?? 4),
    idleTimeoutMillis: 5_000,
    allowExitOnIdle: true,
    connectionTimeoutMillis: 10_000,
  })

  return drizzle(pool, { schema })
}

export type DB = ReturnType<typeof createDb>

let instance: DB | null = null

/**
 * Drop-in replacement for the previous eager `db` export.
 * The Proxy forwards every property access to the real Drizzle instance,
 * creating it on first use. Existing imports keep working unchanged.
 */
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    instance ??= createDb()
    const value = Reflect.get(instance, prop, instance)
    // Bind methods so Drizzle internals keep the correct `this`.
    return typeof value === 'function' ? value.bind(instance) : value
  },
})
