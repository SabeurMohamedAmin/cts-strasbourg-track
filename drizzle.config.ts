import { defineConfig } from 'drizzle-kit'

const databaseUrl = process.env.NUXT_DATABASE_URL

if (!databaseUrl) {
  throw new Error('Missing NUXT_DATABASE_URL. Add it to .env before running Drizzle commands.')
}

export default defineConfig({
  schema: './server/database/schema/*',
  out: './server/database/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrl },
})
