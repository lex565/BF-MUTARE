import { defineConfig } from 'drizzle-kit'

/**
 * Migrations use the DIRECT connection (port 5432), not the pooled one the app
 * runs on. DDL through PgBouncer in transaction mode is unreliable — it can
 * hand successive statements of one migration to different backends.
 *
 * So: DIRECT_URL for drizzle-kit, DATABASE_URL for the running app.
 */
export default defineConfig({
  schema: './db/schema/index.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
  verbose: true,
  strict: true,
})
