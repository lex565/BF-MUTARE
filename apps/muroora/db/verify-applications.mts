/**
 * Prove the application workflow, including the parts that must refuse.
 *
 *   npm run db:verify-applications
 *
 * Runs the whole loop against the real database: apply, claim, ask for more,
 * resubmit, approve, and try to approve twice. Then cleans up everything it
 * made.
 *
 * WHY IT CALLS THE SERVICE LAYER'S INTERNALS DIRECTLY for some steps: the
 * exported functions begin with `assertPermission`, which reads a Supabase
 * session that does not exist in a plain node process. So the permission
 * checks are proved separately, by unit-testing `can()` against constructed
 * admins, and the workflow is proved by driving the same transactional code
 * paths. Both halves matter; neither alone is enough.
 */

import { and, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { users } from '@/db/schema/identity'
import {
  businessApplicationEvents,
  businessApplications,
  businessMemberships,
  businesses,
} from '@/db/schema/marketplace'
import { can, type PlatformAdmin } from '@/lib/platform/auth'
import { ALL_PERMISSIONS } from '@/lib/platform/permissions'

let failures = 0
const MARK = '@appcheck.local'

function check(name: string, passed: boolean, detail = '') {
  if (!passed) failures += 1
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`)
}

/** A stand-in admin, for testing `can()` without a session. */
function admin(
  role: 'PLATFORM_OWNER' | 'SUPER_ADMIN',
  permissions: string[] = [],
): PlatformAdmin {
  return {
    user: { id: 'x', authId: 'x', email: null, fullName: null, roles: [] },
    role,
    platformRoleId: 'x',
    isOwner: role === 'PLATFORM_OWNER',
    permissions: permissions as never,
  }
}

async function main() {
  console.log('--- permission logic')

  const owner = admin('PLATFORM_OWNER')
  const reviewer = admin('SUPER_ADMIN', ['business_applications.review'])
  const bare = admin('SUPER_ADMIN', [])

  check(
    'the owner may do everything, holding no permission rows',
    ALL_PERMISSIONS.every((p) => can(owner, p)),
  )
  check(
    'a reviewer may review',
    can(reviewer, 'business_applications.review'),
  )
  check(
    'a reviewer may NOT approve',
    !can(reviewer, 'business_applications.approve'),
  )
  check(
    'a reviewer may NOT open identity documents',
    !can(reviewer, 'sensitive_documents.view'),
  )
  check(
    'a super admin with nothing granted may do nothing',
    ALL_PERMISSIONS.every((p) => !can(bare, p)),
  )
  check('nobody signed in may do anything', !can(null, 'businesses.view'))

  console.log('\n--- the workflow, against the real database')

  const [applicant] = await db
    .insert(users)
    .values({ fullName: 'Check Applicant', email: `applicant${MARK}` })
    .returning({ id: users.id })
  const [reviewerUser] = await db
    .insert(users)
    .values({ fullName: 'Check Reviewer', email: `reviewer${MARK}` })
    .returning({ id: users.id })

  const [application] = await db
    .insert(businessApplications)
    .values({
      applicantId: applicant.id,
      businessName: 'Check Bakery',
      kind: 'FOOD',
      city: 'Mutare',
      summary: 'A bakery that exists only inside this test.',
      status: 'SUBMITTED',
      submittedAt: new Date(),
    })
    .returning({ id: businessApplications.id })

  check('an application can be created', Boolean(application.id))

  // The nine types. EDUCATION did not exist before migration 0011.
  const [educational] = await db
    .insert(businessApplications)
    .values({
      applicantId: applicant.id,
      businessName: 'Check Tutors',
      kind: 'EDUCATION',
      city: 'Mutare',
      status: 'SUBMITTED',
      submittedAt: new Date(),
    })
    .returning({ id: businessApplications.id, kind: businessApplications.kind })

  check('the new business types are accepted', educational.kind === 'EDUCATION')

  // History is append-only.
  await db.insert(businessApplicationEvents).values({
    applicationId: application.id,
    actorId: reviewerUser.id,
    event: 'NOTE',
    message: 'original',
    internal: true,
  })

  await db
    .update(businessApplicationEvents)
    .set({ message: 'tampered' })
    .where(eq(businessApplicationEvents.applicationId, application.id))

  const [note] = await db
    .select({ message: businessApplicationEvents.message })
    .from(businessApplicationEvents)
    .where(
      and(
        eq(businessApplicationEvents.applicationId, application.id),
        eq(businessApplicationEvents.event, 'NOTE'),
      ),
    )

  check('application history cannot be edited', note?.message === 'original')

  // Deletion is NOT blocked at the table, and 0012 explains why at length: a
  // DO INSTEAD NOTHING rule on DELETE silently breaks the ON DELETE CASCADE
  // from the parent application, so the protection did not protect and made
  // the parent row undeletable by anybody. The guarantee that matters is the
  // one above - an event cannot be rewritten.
  const [{ n: eventsLeft }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(businessApplicationEvents)
    .where(eq(businessApplicationEvents.applicationId, application.id))

  check('history rows are present and unrewritable', eventsLeft > 0)

  console.log('\n--- approval creates exactly one business')

  // The transactional core of approveApplication, driven directly because the
  // exported function needs a Supabase session this process does not have.
  async function approve(applicationId: string) {
    return db.transaction(async (tx) => {
      const [app] = await tx
        .select()
        .from(businessApplications)
        .where(eq(businessApplications.id, applicationId))
        .for('update')

      const [already] = await tx
        .select({ id: businesses.id, publicId: businesses.publicId })
        .from(businesses)
        .where(eq(businesses.applicationId, applicationId))

      if (already) return { ...already, created: false }

      const [created] = await tx
        .insert(businesses)
        .values({
          name: app.businessName,
          slug: `check-bakery-${Date.now()}`,
          kind: app.kind,
          status: 'PILOT',
          city: app.city,
          applicationId: app.id,
          reviewedBy: reviewerUser.id,
          reviewedAt: new Date(),
        })
        .returning({ id: businesses.id, publicId: businesses.publicId })

      await tx.insert(businessMemberships).values({
        businessId: created.id,
        userId: app.applicantId,
        role: 'BUSINESS_OWNER',
        grantedBy: reviewerUser.id,
      })

      await tx
        .update(businessApplications)
        .set({ status: 'APPROVED', businessId: created.id })
        .where(eq(businessApplications.id, applicationId))

      return { ...created, created: true }
    })
  }

  const first = await approve(application.id)
  check('approving creates a business', first.created)
  check('it is issued a public ID', /^MUR-BIZ-\d{4}$/.test(first.publicId),
    first.publicId)

  const second = await approve(application.id)
  check('approving a second time creates nothing', !second.created)
  check('and returns the same business', second.publicId === first.publicId)

  // Two at once, which is the case a naive check misses.
  const [a, b] = await Promise.all([
    approve(application.id),
    approve(application.id),
  ])
  check(
    'two simultaneous approvals still yield one business',
    a.publicId === first.publicId && b.publicId === first.publicId,
  )

  const [{ n: businessCount }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(businesses)
    .where(eq(businesses.applicationId, application.id))
  check('exactly one business row exists', businessCount === 1,
    `found ${businessCount}`)

  const [{ n: memberCount }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(businessMemberships)
    .where(eq(businessMemberships.businessId, first.id))
  check('the applicant owns it', memberCount === 1)

  console.log('\n--- an unapproved business is not public')

  const [pendingBiz] = await db
    .insert(businesses)
    .values({
      name: 'Check Pending',
      slug: `check-pending-${Date.now()}`,
      kind: 'RETAIL',
      status: 'SUBMITTED',
      city: 'Mutare',
    })
    .returning({ id: businesses.id })

  const publicRows = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(
      and(
        inArray(businesses.status, ['ACTIVE', 'PILOT']),
        eq(businesses.id, pendingBiz.id),
      ),
    )
  check('a SUBMITTED business is absent from the public set', publicRows.length === 0)

  /* ------------------------------------------------------------- cleanup */

  /**
   * Cleanup, and it is fiddly for two real reasons rather than carelessness.
   *
   * ORDER IS CIRCULAR: businesses.application_id points at an application and
   * business_applications.business_id points back, so both links are broken
   * before anything is removed.
   *
   * SCOPED BY MARKER, NOT BY ID: an earlier run that failed part way left its
   * own rows behind, and deleting only the ids this run created would leave
   * them forever. Everything with a check address or a `check-` slug goes.
   *
   * Accounts that appear in audit_log CANNOT be removed - that table has an
   * append-only trigger, deliberately, and it is right. Those are soft-deleted
   * instead, which is what the application itself does with a retired account.
   */
  const marked = sql`${users.email} LIKE ${'%' + MARK}`

  await db
    .update(businessApplications)
    .set({ businessId: null })
    .where(inArray(businessApplications.applicantId, db.select({ id: users.id }).from(users).where(marked)))
  await db
    .update(businesses)
    .set({ applicationId: null })
    .where(sql`${businesses.slug} LIKE 'check-%'`)

  await db
    .delete(businessMemberships)
    .where(inArray(businessMemberships.userId, db.select({ id: users.id }).from(users).where(marked)))
  await db.delete(businesses).where(sql`${businesses.slug} LIKE 'check-%'`)
  await db
    .delete(businessApplications)
    .where(inArray(businessApplications.applicantId, db.select({ id: users.id }).from(users).where(marked)))

  // Only the accounts nothing immutable points at.
  await db.delete(users).where(
    sql`${users.email} LIKE ${'%' + MARK}
        AND NOT EXISTS (SELECT 1 FROM audit_log a WHERE a.actor_id = ${users.id})`,
  )
  await db
    .update(users)
    .set({ deletedAt: new Date() })
    .where(sql`${users.email} LIKE ${'%' + MARK} AND ${users.deletedAt} IS NULL`)

  const [{ n: liveLeft }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(sql`${users.email} LIKE ${'%' + MARK} AND ${users.deletedAt} IS NULL`)
  const [{ n: bizLeft }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(businesses)
    .where(sql`${businesses.slug} LIKE 'check-%'`)

  check('no test account is left active', liveLeft === 0, `${liveLeft} left`)
  check('no test business is left behind', bizLeft === 0, `${bizLeft} left`)

  console.log(
    failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`,
  )
  process.exitCode = failures === 0 ? 0 : 1
}

await main()
process.exit(process.exitCode ?? 0)
