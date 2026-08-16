import { readFileSync } from 'node:fs'
import { defineConfig } from 'drizzle-kit'

/**
 * Load .env.local by hand.
 *
 * Next reads it automatically; drizzle-kit is a standalone CLI and does not,
 * so without this the migration runs against an empty connection string and
 * fails with a message that does not obviously say "your env was not loaded".
 */
try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim()
  }
} catch {
  // No .env.local yet - the error below is clearer than a parse failure here.
}

/**
 * Migrations use the DIRECT connection (port 5432), not the pooled one the app
 * runs on. DDL through PgBouncer in transaction mode is unreliable - it can
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
