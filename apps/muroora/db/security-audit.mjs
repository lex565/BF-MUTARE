/**
 * What can somebody with only the public key actually reach?
 *
 *   npm run security:audit
 *
 * READ ONLY. It selects, it never writes, and it touches no real row - the
 * write probes below deliberately send invalid payloads so that a table which
 * WOULD accept the write still rejects the row. The point is to learn whether
 * the door is locked, not to walk through it.
 *
 * WHY THIS EXISTS RATHER THAN TRUSTING THE ADVISOR. Supabase's Security
 * Advisor reports configuration - "RLS is off on this table". It does not tell
 * you what an attacker actually gets, and a table can have RLS enabled and
 * still be wide open through a permissive policy. Real pilot applicants are now
 * uploading national IDs and photographs of themselves holding them, so the
 * only answer worth having is the empirical one: point the anon key at every
 * table and see what comes back.
 */

import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anonKey || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL, ANON_KEY and SERVICE_ROLE_KEY must be set.')
  process.exit(1)
}

const sql = postgres(process.env.DIRECT_URL, { max: 1, prepare: false })
const anon = createClient(url, anonKey, { auth: { persistSession: false } })
const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

/** Tables holding something that would harm a person if it leaked. */
const SENSITIVE = new Set([
  'users',
  'user_roles',
  'orders',
  'order_items',
  'addresses',
  'carts',
  'cart_items',
  'staff_profiles',
  'audit_log',
  'platform_audit_log',
  'platform_roles',
  'platform_permissions',
  'business_applications',
  'business_application_documents',
  'business_application_events',
  'businesses',
  'business_memberships',
  'beta_feedback',
  'riders',
  'rider_documents',
  'deliveries',
  'payments',
])

console.log('MUSUWO SECURITY AUDIT')
console.log(`Project ${new URL(url).hostname.split('.')[0]}`)
console.log(`Run     ${new Date().toISOString()}\n`)

/* ---------------------------------------------------- 1. RLS per table */

const tables = await sql`
  SELECT c.relname AS table,
         c.relrowsecurity AS rls_enabled,
         c.relforcerowsecurity AS rls_forced,
         (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  ORDER BY c.relname
`

const rlsOff = tables.filter((t) => !t.rls_enabled)
const rlsOnNoPolicy = tables.filter((t) => t.rls_enabled && t.policies === 0)
const rlsOnWithPolicy = tables.filter((t) => t.rls_enabled && t.policies > 0)

console.log('1. ROW LEVEL SECURITY')
console.log(`   tables in public schema     ${tables.length}`)
console.log(`   RLS ON, no policies         ${rlsOnNoPolicy.length}  (denies everything - correct here)`)
console.log(`   RLS ON, with policies       ${rlsOnWithPolicy.length}`)
console.log(`   RLS OFF                     ${rlsOff.length}${rlsOff.length ? '  <-- rls_disabled_in_public' : ''}`)

if (rlsOff.length) {
  console.log('\n   TABLES WITH RLS OFF:')
  for (const t of rlsOff) {
    console.log(`     ${t.table}${SENSITIVE.has(t.table) ? '   ** SENSITIVE **' : ''}`)
  }
}
if (rlsOnWithPolicy.length) {
  console.log('\n   TABLES WITH POLICIES (each needs reading, not counting):')
  for (const t of rlsOnWithPolicy) console.log(`     ${t.table}  ${t.policies} policy/policies`)
}

/* -------------------------------------- 2. what the anon key can READ */

console.log('\n2. ANONYMOUS READS  (the public key, which ships in the website and the APK)')

/**
 * A TABLE THAT RETURNS ZERO ROWS IS NOT EXPOSED.
 *
 * This is the trap in auditing PostgREST, and the first version of this script
 * fell into it. When RLS is enabled with no policies, a SELECT does not error -
 * it returns 200 and an empty array. So "no error" means the request was
 * accepted, not that data came back, and reporting that as an exposure raises
 * a false alarm on a correctly locked table.
 *
 * The only sound test compares what the ANON key sees against what is actually
 * in the table, read with the service role. Anonymous rows > 0 is an exposure.
 * Anonymous 0 against a table holding rows is RLS doing its job. Anonymous 0
 * against an empty table tells you nothing either way, and is reported as
 * such rather than as a pass.
 */
const readable = []
const untested = []

for (const t of tables) {
  const { data, error } = await anon.from(t.table).select('*').limit(2)
  if (error) continue // refused outright

  const [{ n: actual }] = await sql`
    SELECT count(*)::int AS n FROM ${sql(t.table)}
  `

  if (data && data.length > 0) {
    readable.push({ table: t.table, rows: data.length, actual })
  } else if (actual === 0) {
    untested.push(t.table)
  }
}

if (readable.length === 0) {
  console.log('   NO ROWS were returned from any table.')
  const held = tables.length - untested.length
  console.log(`   ${held} table(s) hold rows and returned none of them - RLS is working.`)
  if (untested.length) {
    console.log(`   ${untested.length} table(s) are empty, so they prove nothing either way:`)
    console.log(`     ${untested.join(', ')}`)
  }
} else {
  for (const r of readable) {
    const flag = SENSITIVE.has(r.table) ? '  ** SENSITIVE - REAL DATA IS EXPOSED **' : ''
    console.log(
      `   EXPOSED  ${r.table.padEnd(34)} returned ${r.rows} of ${r.actual} row(s)${flag}`,
    )
  }
}

/* ------------------------------------- 3. what the anon key can WRITE */

console.log('\n3. ANONYMOUS WRITES')
console.log('   Probing with deliberately invalid rows: a table that would ACCEPT the')
console.log('   insert still rejects this one, so nothing real is created.')

const writable = []
for (const t of tables) {
  // Missing every required column. A permission error means the door is shut;
  // a constraint/column error means the door was open and the row was bad.
  const { error } = await anon.from(t.table).insert({ __audit_probe__: 1 })
  if (!error) {
    writable.push(t.table)
    continue
  }
  const msg = `${error.message} ${error.code ?? ''}`.toLowerCase()
  const blockedByPermission =
    msg.includes('row-level security') ||
    msg.includes('permission denied') ||
    msg.includes('violates row-level') ||
    error.code === '42501' ||
    error.code === 'PGRST301' ||
    msg.includes('jwt') ||
    msg.includes('not find the table') ||
    msg.includes('schema cache')
  if (!blockedByPermission) writable.push(`${t.table} (reached the table: ${error.code})`)
}

if (writable.length === 0) {
  console.log('   nothing. Every table refused the write before looking at the row.')
} else {
  for (const w of writable) console.log(`   WRITABLE  ${w}   ** ANYBODY CAN INSERT **`)
}

/* ------------------------------------------------- 4. sensitive columns */

console.log('\n4. SENSITIVE COLUMNS  (sensitive_columns_exposed)')

const sensitiveCols = await sql`
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (
      column_name IN ('id_number','licence_number','residential_address','path',
                      'contact_phone','contact_email','phone','email',
                      'licence_document_path','whatsapp')
    )
  ORDER BY table_name, column_name
`
// Only meaningful for tables that ACTUALLY returned rows to the anon key.
// A sensitive column on a table nobody can read is not exposed.
const exposedCols = sensitiveCols.filter((c) =>
  readable.some((r) => r.table === c.table_name),
)
if (exposedCols.length === 0) {
  console.log(`   ${sensitiveCols.length} sensitive column(s) exist, and none sit on a table`)
  console.log('   the public key can read a row from.')
} else {
  for (const c of exposedCols) {
    console.log(`   EXPOSED  ${c.table_name}.${c.column_name}   ** READABLE ANONYMOUSLY **`)
  }
}

/* ---------------------------------------------------------- 5. storage */

console.log('\n5. STORAGE BUCKETS')

const { data: buckets } = await admin.storage.listBuckets()
for (const b of buckets ?? []) {
  const holdsIdentity = b.name === 'business-verification' || b.name.includes('rider')
  console.log(
    `   ${b.name.padEnd(26)} ${b.public ? 'PUBLIC ' : 'private'}${
      b.public && holdsIdentity ? '  ** IDENTITY DOCUMENTS ARE PUBLIC **' : ''
    }`,
  )
}

// Prove the private one refuses the public key rather than trusting the flag.
const verification = buckets?.find((b) => b.name === 'business-verification')
if (verification) {
  const { data: listed, error: listErr } = await anon.storage
    .from('business-verification')
    .list('')
  const canList = !listErr && Array.isArray(listed) && listed.length > 0
  console.log(
    `   anon can list business-verification: ${canList ? 'YES  ** EXPOSED **' : 'no'}`,
  )

  const [realDoc] = await sql`
    SELECT path FROM business_application_documents LIMIT 1
  `
  if (realDoc) {
    const { error: dlErr } = await anon.storage
      .from('business-verification')
      .download(realDoc.path)
    console.log(
      `   anon can download a real document:   ${dlErr ? 'no' : 'YES  ** EXPOSED **'}`,
    )
  } else {
    console.log('   (no documents stored yet to test a download against)')
  }
}

/* ------------------------------------------- 6. service-role exposure */

console.log('\n6. SERVICE-ROLE KEY EXPOSURE')

const [{ n: publicVars }] = await sql`SELECT 0::int AS n`
void publicVars

const leaks = []
// A service-role JWT has "role":"service_role" in its payload. Look for the
// key itself anywhere it could reach a browser or a phone.
const fingerprint = serviceKey.slice(-24)
const { execSync } = await import('node:child_process')

for (const dir of ['.next/static', 'public', '../muroora-mobile/dist', '../muroora-mobile/src']) {
  try {
    const out = execSync(
      `grep -rl "${fingerprint}" "${dir}" 2>/dev/null || true`,
      { cwd: process.cwd(), encoding: 'utf8', shell: '/usr/bin/bash' },
    ).trim()
    if (out) leaks.push(...out.split('\n'))
  } catch {
    /* directory absent - nothing to check */
  }
}

if (leaks.length === 0) {
  console.log('   not found in .next/static, public/, or the mobile app source or build.')
  console.log('   (SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix, so Next cannot inline it.)')
} else {
  console.log('   ** SERVICE ROLE KEY FOUND IN CLIENT-REACHABLE FILES **')
  for (const f of leaks) console.log(`     ${f}`)
}

/* ----------------------------------------------------------- verdict */

const problems =
  readable.filter((r) => SENSITIVE.has(r.table)).length +
  writable.length +
  exposedCols.length +
  leaks.length +
  (buckets ?? []).filter((b) => b.public && b.name === 'business-verification').length

console.log('\n' + '='.repeat(62))
if (problems === 0) {
  console.log('VERDICT: no anonymous access to any sensitive table, column,')
  console.log('         document or bucket was found.')
} else {
  console.log(`VERDICT: ${problems} EXPOSURE(S) FOUND. See the ** marks above.`)
}
console.log('='.repeat(62))

await sql.end()
process.exit(problems === 0 ? 0 : 1)
