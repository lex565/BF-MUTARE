import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

/**
 * The database handle.
 *
 * Supabase Postgres over postgres.js. Two things worth knowing:
 *
 * 1. USE THE POOLED CONNECTION STRING (port 6543, `?pgbouncer=true`), not the
 *    direct one. Every serverless invocation opens its own connection, and a
 *    Supabase project's direct connection limit is small enough that a modest
 *    traffic spike will exhaust it and start refusing requests.
 *
 * 2. `prepare: false` is required with PgBouncer in transaction mode.
 *    Prepared statements are per-connection state, and the pooler hands the
 *    next query to a different backend — so a prepared statement silently
 *    disappears. This shows up as intermittent "prepared statement does not
 *    exist" errors under load and is miserable to diagnose after the fact.
 */

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env.local and paste the ' +
      'Supabase pooled connection string (Project Settings → Database → ' +
      'Connection pooling, port 6543).',
  )
}

/**
 * Reused across hot reloads in development. Without this, every file save
 * opens a new pool and the connection limit is reached within a few minutes.
 */
const globalForDb = globalThis as unknown as {
  __muroora_sql?: ReturnType<typeof postgres>
}

const client =
  globalForDb.__muroora_sql ??
  postgres(connectionString, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__muroora_sql = client
}

export const db = drizzle(client, { schema })
export { schema }
export type Db = typeof db
