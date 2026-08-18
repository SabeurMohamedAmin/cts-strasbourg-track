import 'dotenv/config'

/**
 * Migration runner — usage: pnpm db:migrate
 *
 * Why not `drizzle-kit migrate`: it exits with code 1 without printing the
 * driver error, so a failing migration (TLS, permissions, an unsupported
 * statement) is impossible to diagnose. This runs the same drizzle-orm
 * migrator and reports exactly what the database said.
 *
 * Uses the same bootstrap as scripts/import-gtfs.ts: dotenv + resolveSsl(),
 * so it connects exactly like the server does.
 */

import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import { Pool } from 'pg'
import { resolveSsl } from '../server/database/ssl'

const MIGRATIONS_FOLDER = './server/database/migrations'

const databaseUrl = process.env.NUXT_DATABASE_URL

if (!databaseUrl) {
  throw new Error('Missing NUXT_DATABASE_URL. Add it to .env before running migrations.')
}

/** Everything a pg error can carry — all of it is useful when a migration fails. */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error)

  const pgError = error as Error & {
    code?: string
    detail?: string
    hint?: string
    position?: string
    routine?: string
  }

  const lines = [`${pgError.name}: ${pgError.message}`]
  if (pgError.code) lines.push(`  code:     ${pgError.code}`)
  if (pgError.detail) lines.push(`  detail:   ${pgError.detail}`)
  if (pgError.hint) lines.push(`  hint:     ${pgError.hint}`)
  if (pgError.position) lines.push(`  position: ${pgError.position}`)
  if (pgError.routine) lines.push(`  routine:  ${pgError.routine}`)
  if (pgError.cause instanceof Error) lines.push(`  cause:    ${pgError.cause.message}`)

  return lines.join('\n')
}

async function main(): Promise<void> {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: resolveSsl(),
    max: 1,
    allowExitOnIdle: true,
    connectionTimeoutMillis: 15_000,
  })

  const db = drizzle(pool)

  try {
    // Separate step so a connection/TLS problem is never reported as a
    // migration problem.
    const probe = await db.execute<{ version: string }>(sql`select version()`)
    console.info(`[db:migrate] Connected: ${probe.rows[0]?.version ?? 'unknown server'}`)

    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })

    const applied = await db.execute<{ count: string }>(
      sql`select count(*)::text as count from drizzle.__drizzle_migrations`,
    )
    console.info(`[db:migrate] Up to date — ${applied.rows[0]?.count ?? '?'} migration(s) applied.`)
  }
  catch (error) {
    console.error(`[db:migrate] FAILED\n${describeError(error)}`)
    process.exitCode = 1
  }
  finally {
    await pool.end()
  }
}

await main()
