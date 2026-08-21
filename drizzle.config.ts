import { defineConfig } from 'drizzle-kit'
import { resolveSsl } from './server/database/ssl'

const databaseUrl = process.env.NUXT_DATABASE_URL

if (!databaseUrl) {
  throw new Error('Missing NUXT_DATABASE_URL. Add it to .env before running Drizzle commands.')
}

export default defineConfig({
  schema: './server/database/schema/*',
  out: './server/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
    // Same TLS resolution as the runtime pool (server/database/index.ts).
    // Without this, drizzle-kit verified the chain with Node's defaults and
    // failed against providers whose certificate the app accepts via
    // NUXT_DATABASE_SSL_CA / NUXT_DATABASE_SSL_REJECT_UNAUTHORIZED.
    ssl: resolveSsl(),
  },
})
