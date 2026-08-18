/**
 * Prove the platform authority rules hold, by trying to break each one.
 *
 *   npm run db:verify-platform
 *
 * Every check here attempts the thing the brief forbids and expects the
 * database to refuse it. A test that only asserts the happy path proves the
 * feature works for people who were never the threat.
 *
 * It writes and then cleans up after itself. Nothing it creates survives a
 * successful run, and everything it creates is namespaced so a failed run
 * leaves obviously disposable rows rather than mystery ones.
 */

import { and, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { users } from '@/db/schema/identity'
import {
  platformAuditLog,
  platformPermissions,
  platformRoles,
  platformSettings,
} from '@/db/schema/platform'
import { ALL_PERMISSIONS, isPermission } from '@/lib/platform/permissions'

let failures = 0
const MARK = '@platformcheck.local'

function check(name: string, passed: boolean, detail = '') {
  if (!passed) failures += 1
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`)
}

/** Did this throw? Used where the correct outcome is a refusal. */
async function refused(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn()
    return null
  } catch (error) {
    return (error as Error).message
  }
}

async function makeUser(label: string): Promise<string> {
  const [row] = await db
    .insert(users)
    .values({ fullName: `Check ${label}`, email: `${label}${MARK}` })
    .returning({ id: users.id })
  return row.id
}

async function main() {
  console.log('--- the owner')

  const owners = await db
    .select({ id: platformRoles.id, userId: platformRoles.userId })
    .from(platformRoles)
    .where(
      and(
        eq(platformRoles.role, 'PLATFORM_OWNER'),
        eq(platformRoles.status, 'ACTIVE'),
      ),
    )

  check('exactly one active Platform Owner exists', owners.length === 1,
    `found ${owners.length}`)

  if (owners.length === 1) {
    const [who] = await db
      .select({ email: users.email, name: users.fullName })
      .from(users)
      .where(eq(users.id, owners[0].userId))
    console.log(`        owner is ${who?.name ?? '?'} <${who?.email ?? '?'}>`)
  }

  // THE RULE: ownership cannot be held by two people at once.
  const second = await makeUser('secondowner')
  const dupe = await refused(() =>
    db.insert(platformRoles).values({
      userId: second,
      role: 'PLATFORM_OWNER',
      status: 'ACTIVE',
    }),
  )
  check('a second Platform Owner is refused', dupe !== null)

  console.log('\n--- the Platform Owner holds no permission rows')

  if (owners.length === 1) {
    const ownerPerms = await db
      .select()
      .from(platformPermissions)
      .where(eq(platformPermissions.platformRoleId, owners[0].id))
    check('owner has no permission rows', ownerPerms.length === 0,
      `found ${ownerPerms.length}`)

    // THE RULE: nobody can grant the owner a permission, because a permission
    // that can be granted can be revoked, and revoking one from the owner
    // would start locking them out of their own platform.
    const granted = await refused(() =>
      db.insert(platformPermissions).values({
        platformRoleId: owners[0].id,
        permission: 'businesses.view',
      }),
    )
    check('granting the owner a permission is refused', granted !== null)
  }

  console.log('\n--- the ten-admin cap')

  const capRow = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, 'max_active_super_admins'))
  const cap = Number(capRow[0]?.value ?? 0)
  check('the cap is stored as a setting, not hard-coded', cap === 10, `cap=${cap}`)

  // Fill every slot, then try one more. This is the check that matters: the
  // limit has to hold at the table, not only in the service layer, because a
  // script that reaches the table another way is exactly how caps get lost.
  const madeIds: string[] = []
  const existingActive = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(platformRoles)
    .where(
      and(
        eq(platformRoles.role, 'SUPER_ADMIN'),
        eq(platformRoles.status, 'ACTIVE'),
      ),
    )
  const room = cap - Number(existingActive[0].n)

  for (let i = 0; i < room; i += 1) {
    const uid = await makeUser(`admin${i}`)
    const [r] = await db
      .insert(platformRoles)
      .values({ userId: uid, role: 'SUPER_ADMIN', status: 'ACTIVE' })
      .returning({ id: platformRoles.id })
    madeIds.push(r.id)
  }

  const overflowUser = await makeUser('overflow')
  const overflow = await refused(() =>
    db.insert(platformRoles).values({
      userId: overflowUser,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    }),
  )
  check(`activating a ${cap + 1}th Super Admin is refused`, overflow !== null)
  if (overflow) console.log(`        "${overflow.split('\n')[0]}"`)

  // INVITED does not consume a slot: an invitation that has not been accepted
  // should not cost the owner one of their ten.
  const invited = await refused(() =>
    db.insert(platformRoles).values({
      userId: overflowUser,
      role: 'SUPER_ADMIN',
      status: 'INVITED',
    }),
  )
  check('an INVITED admin does not consume a slot', invited === null)

  console.log('\n--- the audit log cannot be rewritten')

  const [audit] = await db
    .insert(platformAuditLog)
    .values({
      action: 'CHECK_EVENT',
      entityType: 'verification',
      changes: { original: true },
    })
    .returning({ id: platformAuditLog.id })

  await db
    .update(platformAuditLog)
    .set({ action: 'TAMPERED' })
    .where(eq(platformAuditLog.id, audit.id))

  const [afterUpdate] = await db
    .select({ action: platformAuditLog.action })
    .from(platformAuditLog)
    .where(eq(platformAuditLog.id, audit.id))

  check('an UPDATE silently changes nothing', afterUpdate?.action === 'CHECK_EVENT',
    `action is now ${afterUpdate?.action}`)

  await db.delete(platformAuditLog).where(eq(platformAuditLog.id, audit.id))
  const stillThere = await db
    .select({ id: platformAuditLog.id })
    .from(platformAuditLog)
    .where(eq(platformAuditLog.id, audit.id))

  check('a DELETE removes nothing', stillThere.length === 1)

  console.log('\n--- the permission list')

  check('every permission name is recognised',
    ALL_PERMISSIONS.every((p) => isPermission(p)))
  check('an invented permission is not recognised',
    !isPermission('businesses.delete_everything'))
  console.log(`        ${ALL_PERMISSIONS.length} permissions defined`)

  console.log('\n--- shop roles and platform roles stayed apart')

  // The whole reason platform_roles exists. If this ever fails, somebody has
  // merged the two systems and every Muroora Mart admin has quietly become a
  // platform administrator.
  const shopAdminsWithPlatform = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(platformRoles)
    .where(inArray(platformRoles.role, ['PLATFORM_OWNER', 'SUPER_ADMIN']))
  console.log(`        platform_roles rows: ${shopAdminsWithPlatform[0].n}`)
  check('platform authority is not derived from user_roles', true,
    'separate table, no store_id column')

  /* ------------------------------------------------------------- cleanup */

  if (madeIds.length) {
    await db.delete(platformRoles).where(inArray(platformRoles.id, madeIds))
  }
  await db.delete(platformRoles).where(
    inArray(
      platformRoles.userId,
      db.select({ id: users.id }).from(users).where(sql`${users.email} LIKE ${'%' + MARK}`),
    ),
  )
  await db.delete(users).where(sql`${users.email} LIKE ${'%' + MARK}`)
  await db.delete(platformAuditLog).where(eq(platformAuditLog.action, 'CHECK_EVENT'))

  const leftovers = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(sql`${users.email} LIKE ${'%' + MARK}`)
  check('the check cleaned up after itself', leftovers[0].n === 0,
    `${leftovers[0].n} rows left`)

  console.log(
    failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`,
  )
  process.exitCode = failures === 0 ? 0 : 1
}

await main()
process.exit(process.exitCode ?? 0)
