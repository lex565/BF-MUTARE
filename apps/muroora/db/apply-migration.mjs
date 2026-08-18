/**
 * Apply one migration file, inside a transaction.
 *
 *   npm run db:apply 0010_platform_authority
 *   npm run db:apply 0010_platform_authority -- --dry
 *
 * WHY THIS EXISTS RATHER THAN `drizzle-kit migrate`.
 *
 * The drizzle journal at db/migrations/meta/_journal.json stops at 0007.
 * Migrations 0008 and 0009 are real, are applied to the live database, and are
 * not in it - they were run by hand because both needed SQL drizzle-kit does
 * not generate: RLS statements, triggers, rules, partial indexes and data
 * backfills. Running `drizzle-kit migrate` now would consult that journal,
 * conclude 0008 onwards had never run, and try them again.
 *
 * So the honest thing is a runner that does exactly what was already being
 * done by hand, but in a transaction and with the file named on the command
 * line, instead of pasting SQL into a console where a half-applied migration
 * is one dropped connection away.
 *
 * EVERYTHING RUNS IN ONE TRANSACTION. Postgres does DDL transactionally, so a
 * failure at statement forty rolls back the previous thirty-nine and the
 * database is exactly as it was. This is the single most important line in the
 * file: a partially applied migration on a live database with real orders in
 * it is far worse than a migration that did not run.
 *
 * DIRECT_URL, never DATABASE_URL. The pooler runs in transaction mode, where
 * DDL is unreliable; the direct connection is what drizzle-kit itself uses.
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import postgres from 'postgres'

const here = dirname(fileURLToPath(import.meta.url))

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const name = args.find((a) => !a.startsWith('--'))

if (!name) {
  console.error(
    'Name the migration, without the .sql:\n  npm run db:apply 0010_platform_authority',
  )
  process.exit(1)
}

const file = join(here, 'migrations', `${name.replace(/\.sql$/, '')}.sql`)
const text = await readFile(file, 'utf8')

console.log(`File   ${file}`)
console.log(`Size   ${text.length} bytes`)

if (dry) {
  console.log('\n--dry: not applied. The SQL that would run:\n')
  console.log(text)
  process.exit(0)
}

if (!process.env.DIRECT_URL) {
  console.error('DIRECT_URL is not set. Run through npm so .env.local loads.')
  process.exit(1)
}

const sql = postgres(process.env.DIRECT_URL, { max: 1, prepare: false })

try {
  await sql.begin(async (tx) => {
    await tx.unsafe(text)
  })
  console.log('\nApplied, and committed.')
} catch (error) {
  console.error('\nNOT APPLIED - rolled back, the database is unchanged.')
  console.error(error.message)
  if (error.position) console.error(`  at character ${error.position}`)
  if (error.hint) console.error(`  hint: ${error.hint}`)
  process.exitCode = 1
} finally {
  await sql.end()
}
