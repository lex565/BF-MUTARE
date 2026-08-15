/**
 * Staff SERVICE checks.
 *
 * db/verify-staff.mjs proves the database refuses bad data. This proves the
 * layer above it does the right thing with good data: that promoting writes
 * both the role and the profile, that suspending takes access away, and that
 * the last admin cannot be removed.
 *
 *   npm run db:verify-staff-service
 *
 * Uses the real service functions — not a copy of their logic — so it fails if
 * somebody changes them. Creates its own throwaway accounts and deletes them.
 */

import postgres from 'postgres'
import { and, eq } from 'drizzle-orm'

import { db } from '@/db/client'
import { staffProfiles } from '@/db/schema/staff'
import { userRoles, users } from '@/db/schema/identity'
import { auditLog } from '@/db/schema/delivery'
import {
  promoteToStaff,
  revokeRole,
  setStaffStatus,
  listStaff,
  findAccounts,
  StaffError,
} from '@/lib/services/staff'

const TAG = 'svccheck.local'
const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID!

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

const raw = postgres(process.env.DIRECT_URL!, { max: 1, prepare: false })

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

const rolesOf = async (userId: string) =>
  (
    await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.storeId, STORE_ID)))
  ).map((r) => r.role)

console.log('\nStaff service — exercising the real functions\n')

const leftover = await raw`
  SELECT id FROM users WHERE email LIKE ${'%' + TAG} AND deleted_at IS NULL
`
if (leftover.length > 0) {
  console.error(`${leftover.length} leftover account(s) from a previous run.`)
  process.exit(1)
}

let alice = '', bob = '', carol = ''

try {
  alice = await makeAccount('alice', 'Alice Service')
  bob = await makeAccount('bob', 'Bob Service')
  carol = await makeAccount('carol', 'Carol Service')

  /* ------------------------------------------------------- search */

  console.log('Finding an account')

  if ((await findAccounts('al')).length === 0) {
    ok('two characters returns nothing (no browsable customer list)')
  } else {
    bad('two characters returns nothing')
  }

  const found = await findAccounts('alice')
  if (found.some((f) => f.userId === alice)) {
    ok('a longer search finds them')
  } else {
    bad('a longer search finds them', `got ${found.length} result(s)`)
  }

  if (found.find((f) => f.userId === alice)?.staffNumber === null) {
    ok('a customer has no staff number yet')
  } else {
    bad('a customer has no staff number yet')
  }

  /* ------------------------------------------------------ promote */

  console.log('\nPromoting')

  const { staffNumber } = await promoteToStaff(
    { userId: alice, role: 'SHOP_STAFF', jobTitle: 'Shop assistant' },
    alice,
  )

  if (/^MM-STF-\d{4,}$/.test(staffNumber)) {
    ok(`promoting issues a staff number (${staffNumber})`)
  } else {
    bad('promoting issues a staff number', staffNumber)
  }

  if ((await rolesOf(alice)).includes('SHOP_STAFF')) {
    ok('the role is granted')
  } else {
    bad('the role is granted')
  }

  const [prof] = await db
    .select()
    .from(staffProfiles)
    .where(eq(staffProfiles.userId, alice))
  if (prof && prof.jobTitle === 'Shop assistant' && prof.status === 'ACTIVE') {
    ok('the staff profile is created with the job title')
  } else {
    bad('the staff profile is created with the job title')
  }

  const audits = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.entityId, alice))
  if (audits.some((a) => a.action === 'STAFF_PROMOTED')) {
    ok('it is written to the audit log')
  } else {
    bad('it is written to the audit log')
  }

  const second = await promoteToStaff(
    { userId: alice, role: 'RIDER' },
    alice,
  )
  if (second.staffNumber === staffNumber) {
    ok('a second role reuses the same staff number')
  } else {
    bad('a second role reuses the same staff number', second.staffNumber)
  }

  const aliceRoles = await rolesOf(alice)
  if (aliceRoles.includes('SHOP_STAFF') && aliceRoles.includes('RIDER')) {
    ok('and keeps the first role')
  } else {
    bad('and keeps the first role', aliceRoles.join(','))
  }

  await promoteToStaff({ userId: alice, role: 'SHOP_STAFF' }, alice)
  const dupes = (await rolesOf(alice)).filter((r) => r === 'SHOP_STAFF')
  if (dupes.length === 1) {
    ok('granting the same role twice does not duplicate it')
  } else {
    bad('granting the same role twice does not duplicate it', `${dupes.length}`)
  }

  try {
    await promoteToStaff(
      { userId: '00000000-0000-0000-0000-000000000000', role: 'SHOP_STAFF' },
      alice,
    )
    bad('promoting a non-existent account is refused')
  } catch (e) {
    if (e instanceof StaffError && e.code === 'NOT_FOUND') {
      ok('promoting a non-existent account is refused')
    } else {
      bad('promoting a non-existent account is refused', String(e))
    }
  }

  /* --------------------------------------------- suspend and leave */

  console.log('\nSuspending and leaving')

  await setStaffStatus({ userId: alice, status: 'SUSPENDED' }, alice)

  const afterSuspend = await rolesOf(alice)
  if (!afterSuspend.includes('SHOP_STAFF') && !afterSuspend.includes('RIDER')) {
    ok('suspending takes away staff and rider access')
  } else {
    bad('suspending takes away access', afterSuspend.join(','))
  }
  if (afterSuspend.includes('CUSTOMER')) {
    ok('but they can still shop as a customer')
  } else {
    bad('but they can still shop as a customer')
  }

  const [stillOnRecord] = await db
    .select()
    .from(staffProfiles)
    .where(eq(staffProfiles.userId, alice))
  if (stillOnRecord?.staffNumber === staffNumber) {
    ok('their record and staff number survive')
  } else {
    bad('their record and staff number survive')
  }

  await setStaffStatus({ userId: alice, status: 'LEFT', notes: 'moved' }, alice)
  const [left] = await db
    .select()
    .from(staffProfiles)
    .where(eq(staffProfiles.userId, alice))
  if (left.status === 'LEFT' && left.leftAt !== null) {
    ok('marking them as left records the date')
  } else {
    bad('marking them as left records the date')
  }

  const back = await promoteToStaff({ userId: alice, role: 'SHOP_STAFF' }, alice)
  const [rehired] = await db
    .select()
    .from(staffProfiles)
    .where(eq(staffProfiles.userId, alice))
  if (
    back.staffNumber === staffNumber &&
    rehired.status === 'ACTIVE' &&
    rehired.leftAt === null
  ) {
    ok('re-hiring restores them under the SAME staff number')
  } else {
    bad('re-hiring restores them under the same staff number')
  }

  /* ------------------------------------------------ the last admin */

  console.log('\nThe last admin cannot be locked out')

  const realAdmins = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(and(eq(userRoles.role, 'ADMIN'), eq(userRoles.storeId, STORE_ID)))
  console.log(`  note  ${realAdmins.length} admin(s) exist before this section`)

  // Remove every existing admin's role temporarily so bob is provably the only
  // one, then put them back. Nothing is deleted.
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

  await promoteToStaff({ userId: bob, role: 'ADMIN' }, bob)

  try {
    await revokeRole({ userId: bob, role: 'ADMIN' }, bob)
    bad('removing the only admin is refused')
  } catch (e) {
    if (e instanceof StaffError && e.code === 'LAST_ADMIN') {
      ok('removing the only admin is refused')
    } else {
      bad('removing the only admin is refused', String(e))
    }
  }

  try {
    await setStaffStatus({ userId: bob, status: 'LEFT' }, bob)
    bad('marking the only admin as left is refused')
  } catch (e) {
    if (e instanceof StaffError && e.code === 'LAST_ADMIN') {
      ok('marking the only admin as left is refused')
    } else {
      bad('marking the only admin as left is refused', String(e))
    }
  }

  await promoteToStaff({ userId: carol, role: 'ADMIN' }, bob)
  try {
    await revokeRole({ userId: bob, role: 'ADMIN' }, bob)
    ok('once a second admin exists, the first can be removed')
  } catch (e) {
    bad('once a second admin exists, the first can be removed', String(e))
  }

  // Put the real admins back exactly as they were.
  for (const a of realAdmins) {
    await db
      .insert(userRoles)
      .values({ userId: a.userId, role: 'ADMIN', storeId: STORE_ID })
  }
  const restored = await db
    .select()
    .from(userRoles)
    .where(and(eq(userRoles.role, 'ADMIN'), eq(userRoles.storeId, STORE_ID)))
  const realRestored = restored.filter((r) =>
    realAdmins.some((a) => a.userId === r.userId),
  )
  if (realRestored.length === realAdmins.length) {
    ok(`the ${realAdmins.length} real admin(s) were put back`)
  } else {
    bad('the real admins were put back', 'CHECK THIS BY HAND')
  }

  /* ------------------------------------------------------- listing */

  console.log('\nThe list')

  const list = await listStaff()
  const mine = list.filter((s) => s.email?.endsWith(TAG))
  if (mine.length === 3) {
    ok('all three appear on the staff list')
  } else {
    bad('all three appear on the staff list', `${mine.length} found`)
  }
  if (mine.every((s) => s.staffNumber)) {
    ok('every one of them has a staff number')
  } else {
    bad('every one of them has a staff number')
  }
} finally {
  /**
   * Teardown does exactly what production does, because the database will not
   * let it do anything else — and that is the point.
   *
   * Once an account has acted, `audit_log` holds a foreign key to it, and
   * `audit_log` is append-only, so those rows cannot be removed either. The
   * account therefore cannot be deleted: deleting it would erase who did what.
   * This is why `users` carries a soft delete. A real employee who leaves is
   * marked deleted and keeps their history; they are never removed.
   *
   * So: drop the roles and the staff profile (both ordinary tables), then soft
   * delete the account. Every read path filters on `deleted_at`, so they
   * vanish from every screen while the audit trail stays whole.
   */
  const testIds = (
    await raw`SELECT id FROM users WHERE email LIKE ${'%' + TAG} AND deleted_at IS NULL`
  ).map((r) => r.id as string)

  if (testIds.length > 0) {
    await raw`DELETE FROM staff_profiles WHERE user_id = ANY(${testIds})`
    await raw`DELETE FROM user_roles WHERE user_id = ANY(${testIds})`
    await raw`
      UPDATE users SET deleted_at = now(), full_name = 'removed test account'
      WHERE id = ANY(${testIds})
    `
  }
  console.log(`\nCleanup: soft-deleted ${testIds.length} test account(s)`)
  console.log(
    '        (hard delete is impossible once an account has an audit trail —',
  )
  console.log('         that is the append-only rule working, not a failure)')

  const rest = await raw`SELECT count(*)::int AS n FROM staff_profiles`
  if (rest[0].n === 0) {
    await raw`SELECT setval('staff_number_seq', 1, false)`
    console.log('No staff left; number sequence reset to MM-STF-0001')
  }
  await raw.end()
}

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
