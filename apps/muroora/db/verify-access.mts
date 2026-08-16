/**
 * The access model.
 *
 *   npm run db:verify-access
 *
 * Three rules from the owner's staff list and brief:
 *
 *   1. Only THREE accounts may hold editing-admin power.
 *   2. One person oversees and edits nothing — VIEWER.
 *   3. Staff cannot finish setting up without a photograph.
 *
 * Each is checked by trying to break it. The admin cap is checked at BOTH
 * levels — through the service, and by going round it straight to the table —
 * because a limit that only exists in application code is a limit until
 * somebody opens psql.
 */

import postgres from 'postgres'
import { and, eq } from 'drizzle-orm'

import { db } from '@/db/client'
import { users, userRoles } from '@/db/schema/identity'
import { staffProfiles } from '@/db/schema/staff'
import {
  MAX_ADMINS,
  StaffError,
  countAdmins,
  promoteToStaff,
} from '@/lib/services/staff'
import { staffSetupComplete } from '@/lib/services/staff-photo'

const TAG = 'accesscheck.local'
const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID!
const raw = postgres(process.env.DIRECT_URL!, { max: 1, prepare: false })

let passed = 0
let failed = 0
const ok = (w: string) => {
  passed++
  console.log(`  PASS  ${w}`)
}
const bad = (w: string, d?: string) => {
  failed++
  console.log(`  FAIL  ${w}`)
  if (d) console.log(`        ${d}`)
}

const rolesOf = async (userId: string) =>
  (
    await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.storeId, STORE_ID)))
  ).map((r) => r.role as string)

async function makeAccount(local: string, name: string) {
  const [row] = await db
    .insert(users)
    .values({ email: `${local}@${TAG}`, fullName: name })
    .returning()
  await db
    .insert(userRoles)
    .values({ userId: row.id, role: 'CUSTOMER', storeId: STORE_ID })
  return row.id
}

console.log('\nAccess model — three admins, one observer, photo required\n')

const dirty = await raw`
  SELECT id FROM users WHERE email LIKE ${'%' + TAG} AND deleted_at IS NULL
`
if (dirty.length > 0) {
  console.error(`${dirty.length} leftover account(s) from a previous run.`)
  process.exit(1)
}

const realAdmins = await db
  .select({ userId: userRoles.userId })
  .from(userRoles)
  .where(
    and(
      eq(userRoles.storeId, STORE_ID),
      eq(userRoles.role, 'ADMIN'),
    ),
  )

const madeIds: string[] = []

try {
  // Park the real admins so the count starts from a known place. Restored in
  // the finally block; nothing is deleted.
  for (const a of realAdmins) {
    await db
      .delete(userRoles)
      .where(
        and(
          eq(userRoles.userId, a.userId),
          eq(userRoles.role, 'ADMIN'),
          eq(userRoles.storeId, STORE_ID),
        ),
      )
  }

  const start = await countAdmins()
  console.log(`  note  starting from ${start} admin account(s)\n`)

  /* ------------------------------------------------- 1. the three-cap */

  console.log(`Only ${MAX_ADMINS} accounts may have admin access`)

  for (let i = 0; i < MAX_ADMINS - start; i++) {
    const id = await makeAccount(`admin${i}`, `Admin ${i}`)
    madeIds.push(id)
    await promoteToStaff({ userId: id, role: 'ADMIN' }, id)
  }

  const now = await countAdmins()
  if (now === MAX_ADMINS) {
    ok(`${MAX_ADMINS} admins can be granted`)
  } else {
    bad('three admins can be granted', `count is ${now}`)
  }

  const fourth = await makeAccount('fourth', 'Fourth Person')
  madeIds.push(fourth)

  try {
    await promoteToStaff({ userId: fourth, role: 'ADMIN' }, fourth)
    bad('a fourth admin is refused')
  } catch (e) {
    if (e instanceof StaffError && e.code === 'ADMIN_LIMIT') {
      ok('a fourth admin is refused, with an explanation')
    } else {
      bad('a fourth admin is refused', String(e))
    }
  }

  // Round the service, straight at the table. This is the check that matters:
  // application-level limits are advisory.
  try {
    await raw`
      INSERT INTO user_roles (user_id, role, store_id)
      VALUES (${fourth}, 'ADMIN', ${STORE_ID})
    `
    bad('the database also refuses a fourth admin')
  } catch (e) {
    if (String((e as Error).message).includes('three accounts')) {
      ok('the database ALSO refuses it, bypassing the service entirely')
    } else {
      bad('database-level cap', String(e))
    }
  }

  // Re-granting to somebody who already has it must not be treated as a new
  // admin — otherwise a harmless repeat becomes an error.
  const existing = madeIds[0]
  try {
    await promoteToStaff({ userId: existing, role: 'ADMIN' }, existing)
    ok('re-granting admin to an existing admin still works')
  } catch (e) {
    bad('re-granting to an existing admin', String(e))
  }

  /* --------------------------------------------------- 2. the observer */

  console.log('\nRead-only oversight')

  await promoteToStaff({ userId: fourth, role: 'VIEWER' }, fourth)
  const fourthRoles = await rolesOf(fourth)

  if (fourthRoles.includes('VIEWER')) {
    ok('VIEWER can be granted when admin is full')
  } else {
    bad('VIEWER granted', fourthRoles.join(','))
  }
  if (!fourthRoles.includes('ADMIN')) {
    ok('and it did NOT quietly grant admin as well')
  } else {
    bad('VIEWER leaked admin')
  }

  const afterViewer = await countAdmins()
  if (afterViewer === MAX_ADMINS) {
    ok('a VIEWER does not consume one of the three admin places')
  } else {
    bad('viewer consumed an admin place', `count is ${afterViewer}`)
  }

  /* ------------------------------------------------ 3. the photo gate */

  console.log('\nStaff cannot finish setting up without a photo')

  const before = await staffSetupComplete(fourth)
  if (!before.complete && before.missing.some((m) => m.includes('photograph'))) {
    ok('a staff member with no photo is not set up')
  } else {
    bad('photo gate', JSON.stringify(before))
  }

  await db
    .update(staffProfiles)
    .set({ photoPath: 'MM-STF-TEST/fake.jpg' })
    .where(eq(staffProfiles.userId, fourth))

  const after = await staffSetupComplete(fourth)
  if (after.complete) {
    ok('once a photo is on file they are set up')
  } else {
    bad('photo gate does not clear', JSON.stringify(after))
  }

  const noRecord = await staffSetupComplete(
    '00000000-0000-0000-0000-000000000000',
  )
  if (!noRecord.complete) {
    ok('somebody with no staff record at all is not set up either')
  } else {
    bad('setup check passes for a non-existent staff member')
  }
} catch (error) {
  failed++
  console.log('\n  FAIL  the run stopped early')
  console.log(`        ${error instanceof Error ? error.message : String(error)}`)
} finally {
  console.log('\nCleanup')

  for (const id of madeIds) {
    await raw`DELETE FROM staff_profiles WHERE user_id = ${id}`
    await raw`DELETE FROM user_roles WHERE user_id = ${id}`
    await raw`
      UPDATE users SET deleted_at = now(), full_name = 'removed test account'
      WHERE id = ${id}
    `
  }

  for (const a of realAdmins) {
    await raw`
      INSERT INTO user_roles (user_id, role, store_id)
      VALUES (${a.userId}, 'ADMIN', ${STORE_ID})
    `
  }

  const restored = await countAdmins()
  console.log(
    `  soft-deleted ${madeIds.length} test account(s); ` +
      `${restored} real admin(s) restored`,
  )
  if (restored !== realAdmins.length) {
    console.log('  WARNING: admin count does not match. CHECK BY HAND.')
  }
  await raw.end()
}

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
