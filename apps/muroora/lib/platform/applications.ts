import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import {
  businessApplicationDocuments,
  businessApplicationEvents,
  businessApplications,
  businessMemberships,
  businesses,
} from '@/db/schema/marketplace'
import { categories, stores } from '@/db/schema/catalogue'
import { users } from '@/db/schema/identity'
import { orders } from '@/db/schema/orders'
import { platformAuditLog } from '@/db/schema/platform'
import { assertPermission, type PlatformAdmin } from '@/lib/platform/auth'
import {
  composeMessage,
  notifyApplicant,
  waNumber,
  type NotifyResult,
} from '@/lib/platform/notify'

/**
 * Drop the cached public feeds so an approved business appears immediately.
 *
 * Imported lazily and swallowed on failure, matching the identical helper in
 * lib/services/marketplace.ts: `revalidateTag` throws outside a request
 * context, and the verification scripts call these services from a plain node
 * process. A cache that cannot be dropped is not a reason to fail a write that
 * has already committed - the 300-second backstop covers it.
 */
async function invalidatePublicFeeds(
  scope: 'businesses' | 'products' | 'all',
): Promise<void> {
  try {
    const { revalidateMarketplace } = await import('@/lib/services/marketplace-cache')
    revalidateMarketplace(scope)
  } catch {
    // Outside a request context.
  }
}

/**
 * A drizzle transaction handle.
 *
 * Written as a parameter type rather than casting each `tx` to `typeof db`:
 * a transaction is NOT a database - it has no `$client` - and the cast was
 * TypeScript agreeing to a fiction. Deriving it from `db.transaction` keeps it
 * correct if the driver changes.
 *
 * The union with `typeof db` lets the same helper serve a single statement
 * that needs no transaction, such as adding a note, without either duplicating
 * it or opening a transaction for one insert.
 */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db

/**
 * The application review workflow.
 *
 * Everything a Super Admin can do to a business application lives here, and
 * every function starts by proving the caller may do it. The screens call the
 * same checks to decide what to draw, but the check that matters is this one -
 * a hidden button is not an access control.
 *
 * THE HARD PART IS APPROVAL, and it is hard for one reason: it creates
 * something. Statuses can be flipped back; a business that has been created
 * twice has two public IDs, two owners and two entries in the directory, and
 * the second one cannot be cleanly removed because customers may already have
 * seen it. So approval is one transaction, guarded by a unique index, and safe
 * to run twice.
 */

export class ApplicationError extends Error {
  constructor(
    public code:
      | 'NOT_FOUND'
      | 'WRONG_STATUS'
      | 'ALREADY_APPROVED'
      | 'NEEDS_REASON',
    message: string,
  ) {
    super(message)
    this.name = 'ApplicationError'
  }
}

/** Statuses a reviewer can still act on. */
const OPEN_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'NEEDS_INFORMATION',
] as const

export interface QueueRow {
  id: string
  businessName: string
  kind: string
  city: string
  status: string
  submittedAt: Date | null
  applicantName: string | null
  applicantEmail: string | null
  assignedToId: string | null
  assignedToName: string | null
}

/**
 * The review queue.
 *
 * Oldest first, deliberately. A newest-first queue means the awkward
 * application nobody wants to pick up sinks out of sight and waits forever,
 * which for the person who submitted it is indistinguishable from being
 * ignored.
 */
export async function listApplications(
  filter: 'open' | 'all' | 'approved' | 'rejected' = 'open',
): Promise<QueueRow[]> {
  const reviewer = { id: users.id, name: users.fullName }

  const where =
    filter === 'open'
      ? inArray(businessApplications.status, [...OPEN_STATUSES])
      : filter === 'approved'
        ? eq(businessApplications.status, 'APPROVED')
        : filter === 'rejected'
          ? eq(businessApplications.status, 'REJECTED')
          : undefined

  const rows = await db
    .select({
      id: businessApplications.id,
      businessName: businessApplications.businessName,
      kind: businessApplications.kind,
      city: businessApplications.city,
      status: businessApplications.status,
      submittedAt: businessApplications.submittedAt,
      applicantName: users.fullName,
      applicantEmail: users.email,
      assignedToId: businessApplications.assignedTo,
    })
    .from(businessApplications)
    .leftJoin(users, eq(users.id, businessApplications.applicantId))
    .where(where)
    .orderBy(businessApplications.submittedAt)

  // Resolve reviewer names in one extra query rather than a second join on the
  // same table, which drizzle would need aliasing for and which is not worth
  // the complexity at queue sizes measured in tens.
  const assignedIds = [...new Set(rows.map((r) => r.assignedToId).filter(Boolean))]
  const names = assignedIds.length
    ? await db
        .select(reviewer)
        .from(users)
        .where(inArray(users.id, assignedIds as string[]))
    : []
  const byId = new Map(names.map((n) => [n.id, n.name]))

  return rows.map((r) => ({
    ...r,
    assignedToName: r.assignedToId ? (byId.get(r.assignedToId) ?? null) : null,
  }))
}

export async function countOpenApplications(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(businessApplications)
    .where(inArray(businessApplications.status, [...OPEN_STATUSES]))
  return row.n
}

/**
 * Send a notice, and WRITE DOWN WHETHER IT ACTUALLY WENT.
 *
 * `notifyApplicant` returns whether the email left the building, and until
 * this existed that answer was shown on the reviewer's screen once and then
 * discarded. Reload the page and there was no way to tell whether an applicant
 * had ever been told anything - which matters most in exactly the case it was
 * needed: tarniah23 was asked for information before the mail relay worked,
 * never received it, and nothing in the system recorded that.
 *
 * The row is INTERNAL. "We emailed you" is reviewer bookkeeping and has no
 * place in the applicant's own timeline.
 *
 * It never throws. The decision is committed and the mail has already gone or
 * already failed; losing the bookkeeping is not a reason to fail the request
 * on top of it. A failure here is logged loudly instead, because a silent gap
 * in the record is the thing this function exists to prevent.
 */
async function notifyAndRecord(
  applicationId: string,
  params: Parameters<typeof notifyApplicant>[0],
): Promise<NotifyResult> {
  const notice = await notifyApplicant(params)

  try {
    await db.insert(businessApplicationEvents).values({
      applicationId,
      event: notice.emailed ? 'EMAILED' : 'EMAIL_FAILED',
      message: notice.emailed
        ? `${humanKind(params.kind)} emailed to ${params.applicant.email}.`
        : `${humanKind(params.kind)} NOT emailed. ${notice.emailProblem ?? 'No reason given.'}`,
      internal: true,
    })
  } catch (error) {
    console.error(
      '[applications] could not record the notification outcome:',
      (error as Error).message,
    )
  }

  return notice
}

function humanKind(kind: 'INFO_REQUESTED' | 'APPROVED' | 'REJECTED'): string {
  return kind === 'INFO_REQUESTED'
    ? 'Request for information'
    : kind === 'APPROVED'
      ? 'Approval'
      : 'Rejection'
}

/** One application, with its history and its documents. Reviewer view. */
export async function getApplication(id: string) {
  const [application] = await db
    .select()
    .from(businessApplications)
    .where(eq(businessApplications.id, id))

  if (!application) {
    throw new ApplicationError('NOT_FOUND', 'No such application.')
  }

  const [applicant] = await db
    .select({ id: users.id, name: users.fullName, email: users.email, phone: users.phone })
    .from(users)
    .where(eq(users.id, application.applicantId))

  const history = await db
    .select({
      id: businessApplicationEvents.id,
      event: businessApplicationEvents.event,
      fromStatus: businessApplicationEvents.fromStatus,
      toStatus: businessApplicationEvents.toStatus,
      message: businessApplicationEvents.message,
      internal: businessApplicationEvents.internal,
      createdAt: businessApplicationEvents.createdAt,
      actorName: users.fullName,
    })
    .from(businessApplicationEvents)
    .leftJoin(users, eq(users.id, businessApplicationEvents.actorId))
    .where(eq(businessApplicationEvents.applicationId, id))
    .orderBy(desc(businessApplicationEvents.createdAt))

  // Metadata only. The files themselves are behind a permission check and are
  // never served from here.
  const documents = await db
    .select()
    .from(businessApplicationDocuments)
    .where(eq(businessApplicationDocuments.applicationId, id))

  const [createdBusiness] = await db
    .select({ id: businesses.id, publicId: businesses.publicId, slug: businesses.slug })
    .from(businesses)
    .where(eq(businesses.applicationId, id))

  let assignedToName: string | null = null
  if (application.assignedTo) {
    const [a] = await db
      .select({ name: users.fullName })
      .from(users)
      .where(eq(users.id, application.assignedTo))
    assignedToName = a?.name ?? null
  }

  /**
   * A WhatsApp link that is still here after a reload.
   *
   * The one on the confirmation panel is built from the result of the action
   * that just ran, so it exists for exactly as long as that panel does. Press
   * Approve, glance away, refresh, and the only way to reach the applicant on
   * the surest channel in Zimbabwe is gone until somebody re-runs a decision
   * they have already made. This one is derived from stored state instead, so
   * it can be pressed tomorrow.
   *
   * The text matches WHERE THE APPLICATION ACTUALLY IS, not where it has been.
   * Sending an approved merchant the "we need more documents" message because
   * that was the last thing composed would be worse than sending nothing.
   * Before any decision there is no message to pre-write, so the link opens an
   * empty chat rather than putting words in the reviewer's mouth.
   */
  const phone =
    application.whatsapp ?? application.contactPhone ?? applicant?.phone ?? null

  const composed =
    application.status === 'APPROVED'
      ? composeMessage({
          kind: 'APPROVED',
          businessName: application.businessName ?? 'Your business',
          applicantName: applicant?.name ?? null,
          message: null,
        })
      : application.status === 'REJECTED'
        ? composeMessage({
            kind: 'REJECTED',
            businessName: application.businessName ?? 'Your business',
            applicantName: applicant?.name ?? null,
            // The reason as it was actually given, read back from the event
            // rather than re-invented, so the message and the record agree.
            message: history.find((h) => h.event === 'REJECTED')?.message ?? null,
          })
        : application.status === 'NEEDS_INFORMATION'
          ? composeMessage({
              kind: 'INFO_REQUESTED',
              businessName: application.businessName ?? 'Your business',
              applicantName: applicant?.name ?? null,
              message: application.infoRequested,
            })
          : null

  const number = waNumber(phone)
  const whatsapp = number
    ? {
        number,
        // Built from `number`, which is already known good, rather than from
        // whatsappLink - that re-derives it and so is typed as nullable.
        url: composed
          ? `https://wa.me/${number}?text=${encodeURIComponent(composed.body)}`
          : `https://wa.me/${number}`,
        prewritten: composed !== null,
      }
    : null

  return {
    application,
    applicant,
    history,
    documents,
    createdBusiness,
    assignedToName,
    whatsapp,
  }
}

/** Write one history row. Every state change goes through this. */
async function record(
  tx: Tx,
  params: {
    applicationId: string
    actorId: string
    event: string
    fromStatus?: string | null
    toStatus?: string | null
    message?: string | null
    internal?: boolean
  },
) {
  await tx.insert(businessApplicationEvents).values({
    applicationId: params.applicationId,
    actorId: params.actorId,
    event: params.event,
    fromStatus: (params.fromStatus ?? null) as never,
    toStatus: (params.toStatus ?? null) as never,
    message: params.message ?? null,
    internal: params.internal ?? false,
  })
}

async function audit(
  tx: Tx,
  admin: PlatformAdmin,
  params: {
    action: string
    entityId: string
    changes?: Record<string, unknown>
    reason?: string | null
  },
) {
  await tx.insert(platformAuditLog).values({
    actorId: admin.user.id,
    actorRole: admin.role,
    action: params.action,
    entityType: 'business_application',
    entityId: params.entityId,
    changes: params.changes ?? null,
    reason: params.reason ?? null,
  })
}

/**
 * Take a case, so two admins do not review the same thing.
 *
 * SOFT ON PURPOSE. §22 warns against a hard lock, and it is right: an
 * application claimed by somebody who then goes on leave would be stuck
 * forever. Anybody with review permission can take over a claim, and doing so
 * is recorded, which is a social control rather than a technical one and is
 * the correct strength for the problem.
 */
export async function claimApplication(id: string) {
  const admin = await assertPermission('business_applications.review')

  const [existing] = await db
    .select({ status: businessApplications.status })
    .from(businessApplications)
    .where(eq(businessApplications.id, id))

  if (!existing) throw new ApplicationError('NOT_FOUND', 'No such application.')

  await db.transaction(async (tx) => {
    await tx
      .update(businessApplications)
      .set({
        assignedTo: admin.user.id,
        assignedAt: new Date(),
        status: existing.status === 'SUBMITTED' ? 'UNDER_REVIEW' : existing.status,
        updatedAt: new Date(),
      })
      .where(eq(businessApplications.id, id))

    await record(tx, {
      applicationId: id,
      actorId: admin.user.id,
      event: 'CLAIMED',
      fromStatus: existing.status,
      toStatus: existing.status === 'SUBMITTED' ? 'UNDER_REVIEW' : existing.status,
    })
  })
}

/** Put it back in the pool. */
export async function releaseApplication(id: string) {
  const admin = await assertPermission('business_applications.review')

  await db.transaction(async (tx) => {
    await tx
      .update(businessApplications)
      .set({ assignedTo: null, assignedAt: null, updatedAt: new Date() })
      .where(eq(businessApplications.id, id))

    await record(tx, {
      applicationId: id,
      actorId: admin.user.id,
      event: 'RELEASED',
    })
  })
}

/** A note only reviewers see. */
export async function addInternalNote(id: string, message: string) {
  const admin = await assertPermission('business_applications.review')
  const text = message.trim()
  if (!text) throw new ApplicationError('NEEDS_REASON', 'Write something first.')

  await record(db, {
    applicationId: id,
    actorId: admin.user.id,
    event: 'NOTE',
    message: text,
    internal: true,
  })
}

/**
 * Ask the applicant for more.
 *
 * The message is NOT internal - it is the whole point that they read it. §24.
 */
export async function requestInformation(params: {
  id: string
  message: string
  dueAt?: Date | null
}): Promise<NotifyResult> {
  const admin = await assertPermission('business_applications.review')
  const message = params.message.trim()
  if (!message) {
    throw new ApplicationError(
      'NEEDS_REASON',
      'Say what is needed. "More information" on its own tells the applicant nothing.',
    )
  }

  const [existing] = await db
    .select({
      status: businessApplications.status,
      businessName: businessApplications.businessName,
      name: users.fullName,
      email: users.email,
      // The application's own contact number first: it is the one the business
      // gave for this purpose. The account phone is the fallback.
      applicationPhone: businessApplications.contactPhone,
      whatsapp: businessApplications.whatsapp,
      accountPhone: users.phone,
    })
    .from(businessApplications)
    .leftJoin(users, eq(users.id, businessApplications.applicantId))
    .where(eq(businessApplications.id, params.id))

  if (!existing) throw new ApplicationError('NOT_FOUND', 'No such application.')
  if (existing.status === 'APPROVED' || existing.status === 'REJECTED') {
    throw new ApplicationError(
      'WRONG_STATUS',
      'This application has already been decided.',
    )
  }

  const applicant = {
    name: existing.name,
    email: existing.email,
    phone: existing.whatsapp ?? existing.applicationPhone ?? existing.accountPhone,
  }

  await db.transaction(async (tx) => {
    await tx
      .update(businessApplications)
      .set({
        status: 'NEEDS_INFORMATION',
        infoRequested: message,
        infoDueAt: params.dueAt ?? null,
        updatedAt: new Date(),
      })
      .where(eq(businessApplications.id, params.id))

    await record(tx, {
      applicationId: params.id,
      actorId: admin.user.id,
      event: 'INFO_REQUESTED',
      fromStatus: existing.status,
      toStatus: 'NEEDS_INFORMATION',
      message,
    })

    await audit(tx, admin, {
      action: 'APPLICATION_INFO_REQUESTED',
      entityId: params.id,
      changes: { message },
    })
  })

  /**
   * Tell them, OUTSIDE the transaction and after it has committed.
   *
   * Inside it, a slow mail API would hold a database lock open across a
   * network call; and a failed send would roll back a request the reviewer
   * has already made. The decision is the important half - the notification
   * is best effort, and `notifyApplicant` never throws.
   *
   * Until this existed the message went into the database and nowhere else,
   * so an application could sit in NEEDS_INFORMATION for weeks with each side
   * waiting on the other.
   */
  return notifyAndRecord(params.id, {
    kind: 'INFO_REQUESTED',
    businessName: existing.businessName,
    applicant,
    message,
  })
}

/**
 * Refuse it.
 *
 * A reason is required, recorded, and shown to the applicant. Rejecting
 * somebody's livelihood with a blank field is not acceptable, so the service
 * refuses rather than the form merely discouraging it.
 *
 * The application is NOT deleted (§25). It stays, rejected, with its history.
 */
export async function rejectApplication(params: {
  id: string
  reason: string
}): Promise<NotifyResult> {
  const admin = await assertPermission('business_applications.reject')
  const reason = params.reason.trim()
  if (reason.length < 10) {
    throw new ApplicationError(
      'NEEDS_REASON',
      'Give a real reason. The applicant sees this, and "no" on its own is not something they can act on.',
    )
  }

  const [existing] = await db
    .select({
      status: businessApplications.status,
      businessName: businessApplications.businessName,
      name: users.fullName,
      email: users.email,
      applicationPhone: businessApplications.contactPhone,
      whatsapp: businessApplications.whatsapp,
      accountPhone: users.phone,
    })
    .from(businessApplications)
    .leftJoin(users, eq(users.id, businessApplications.applicantId))
    .where(eq(businessApplications.id, params.id))

  if (!existing) throw new ApplicationError('NOT_FOUND', 'No such application.')
  if (existing.status === 'APPROVED') {
    throw new ApplicationError(
      'WRONG_STATUS',
      'This application was already approved. Suspend the business instead.',
    )
  }

  await db.transaction(async (tx) => {
    await tx
      .update(businessApplications)
      .set({
        status: 'REJECTED',
        reviewedBy: admin.user.id,
        reviewedAt: new Date(),
        reviewNote: reason,
        updatedAt: new Date(),
      })
      .where(eq(businessApplications.id, params.id))

    await record(tx, {
      applicationId: params.id,
      actorId: admin.user.id,
      event: 'REJECTED',
      fromStatus: existing.status,
      toStatus: 'REJECTED',
      message: reason,
    })

    await audit(tx, admin, {
      action: 'APPLICATION_REJECTED',
      entityId: params.id,
      reason,
    })
  })

  /**
   * Tell them, and tell them WHY.
   *
   * A rejection that arrives as silence is the worst outcome for somebody who
   * spent an evening photographing documents. Almost every refusal at this
   * stage is a fixable paper problem, and the email says so - see notify.ts.
   */
  return notifyAndRecord(params.id, {
    kind: 'REJECTED',
    businessName: existing.businessName,
    applicant: {
      name: existing.name,
      email: existing.email,
      phone: existing.whatsapp ?? existing.applicationPhone ?? existing.accountPhone,
    },
    message: reason,
  })
}

/** A URL-safe slug, uniqueness handled by the caller against the table. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/**
 * Approve, and create the business.
 *
 * SAFE TO RUN TWICE, which is the requirement in §23 that most of this
 * function exists to satisfy. Two admins clicking Approve at the same instant,
 * or one admin double-clicking on a slow connection, must produce one
 * business.
 *
 * How: the application row is locked FOR UPDATE at the start of the
 * transaction, so the second caller waits rather than racing. By the time it
 * proceeds, the first has committed and set `businesses.application_id`, which
 * a unique index covers. The second sees the existing business and returns it
 * unchanged. Belt and braces - the lock orders them, the index makes a
 * duplicate impossible even if the lock were somehow bypassed.
 *
 * All of it in one transaction, so a failure while granting the membership
 * cannot leave a business nobody owns.
 */
export async function approveApplication(params: {
  id: string
  note?: string
  /** PILOT by default: live, visible, and marked as still being trialled. */
  status?: 'PILOT' | 'ACTIVE'
}): Promise<{
  businessId: string
  publicId: string
  created: boolean
  notice: NotifyResult | null
}> {
  const admin = await assertPermission('business_applications.approve')

  const result = await db.transaction(async (tx) => {
    // FOR UPDATE. This is the line that makes the double-click safe.
    const [application] = await tx
      .select()
      .from(businessApplications)
      .where(eq(businessApplications.id, params.id))
      .for('update')

    if (!application) {
      throw new ApplicationError('NOT_FOUND', 'No such application.')
    }

    // Already done. Return what exists rather than doing it again.
    const [already] = await tx
      .select({ id: businesses.id, publicId: businesses.publicId })
      .from(businesses)
      .where(eq(businesses.applicationId, params.id))

    if (already) {
      return {
        businessId: already.id,
        publicId: already.publicId,
        created: false,
        businessName: application.businessName,
        applicant: { name: null, email: null, phone: null },
      }
    }

    if (application.status === 'REJECTED') {
      throw new ApplicationError(
        'WRONG_STATUS',
        'This application was rejected. It has to be resubmitted before it can be approved.',
      )
    }

    const [applicantRow] = await tx
      .select({ fullName: users.fullName, email: users.email, phone: users.phone })
      .from(users)
      .where(eq(users.id, application.applicantId))

    // A slug nobody else holds. Loops rather than trusting a counter, because
    // two businesses called "Mutare Bakery" is entirely plausible.
    const base = slugify(application.businessName) || 'business'
    let slug = base
    for (let n = 2; ; n += 1) {
      const [clash] = await tx
        .select({ id: businesses.id })
        .from(businesses)
        .where(eq(businesses.slug, slug))
      if (!clash) break
      slug = `${base}-${n}`
    }

    const [store] = await tx
      .insert(stores)
      .values({
        name: application.businessName,
        slug,
        isFirstParty: false,
        city: application.city,
      })
      .returning({ id: stores.id })

    await tx.insert(categories).values({
      storeId: store.id,
      name: 'General',
      slug: 'general',
      description: 'Products and services from this business.',
    })

    const [business] = await tx
      .insert(businesses)
      .values({
        // public_id has a database default that issues MUR-BIZ-XXXX
        // atomically. Never derived by counting rows here.
        name: application.businessName,
        slug,
        storeId: store.id,
        summary: application.summary ?? null,
        kind: application.kind,
        status: params.status ?? 'PILOT',
        city: application.city,
        contactPhone: application.contactPhone,
        contactEmail: application.contactEmail,
        applicationId: application.id,
        createdBy: admin.user.id,
        reviewedBy: admin.user.id,
        reviewedAt: new Date(),
        reviewNote: params.note ?? null,
      })
      .returning({ id: businesses.id, publicId: businesses.publicId })

    // The applicant becomes the owner of what they applied for. Doing this in
    // the same transaction is the point: a business with no owner is
    // unreachable by the person who is supposed to run it.
    await tx.insert(businessMemberships).values({
      businessId: business.id,
      userId: application.applicantId,
      role: 'BUSINESS_OWNER',
      grantedBy: admin.user.id,
    })

    await tx
      .update(businessApplications)
      .set({
        status: 'APPROVED',
        businessId: business.id,
        reviewedBy: admin.user.id,
        reviewedAt: new Date(),
        reviewNote: params.note ?? null,
        infoRequested: null,
        infoDueAt: null,
        updatedAt: new Date(),
      })
      .where(eq(businessApplications.id, params.id))

    await record(tx, {
      applicationId: params.id,
      actorId: admin.user.id,
      event: 'APPROVED',
      fromStatus: application.status,
      toStatus: 'APPROVED',
      message: params.note ?? null,
    })

    await audit(tx, admin, {
      action: 'APPLICATION_APPROVED',
      entityId: params.id,
      changes: {
        businessId: business.id,
        publicId: business.publicId,
        status: params.status ?? 'PILOT',
      },
    })

    return {
      businessId: business.id,
      publicId: business.publicId,
      created: true,
      businessName: application.businessName,
      applicant: {
        name: applicantRow?.fullName ?? null,
        email: applicantRow?.email ?? null,
        phone:
          application.whatsapp ??
          application.contactPhone ??
          applicantRow?.phone ??
          null,
      },
    }
  })

  // Outside the transaction: a cache drop is not something to roll back, and
  // doing it inside would hold the lock across a network call.
  if (result.created) await invalidatePublicFeeds('all')

  /**
   * Welcome them.
   *
   * ONLY on a real approval, never on the idempotent second click - somebody
   * double-tapping on a slow connection must not receive two welcome emails,
   * which reads as a system that does not know what it just did.
   *
   * Outside the transaction and after the commit: holding a database lock open
   * across a mail relay would be worse than a missed email, and the business is
   * live either way.
   */
  const notice = result.created
    ? await notifyAndRecord(params.id, {
        kind: 'APPROVED',
        businessName: result.businessName,
        applicant: result.applicant,
        message: params.note ?? null,
      })
    : null

  return { ...result, notice }
}

/* ------------------------------------------------------- applicant side */

/**
 * The applicant's own view of their application.
 *
 * Internal notes are filtered out HERE, in the query, rather than in the
 * component. A filter in a template is one refactor away from being dropped;
 * a `where` clause has to be deliberately removed.
 */
export async function myApplication(userId: string) {
  const [application] = await db
    .select()
    .from(businessApplications)
    .where(eq(businessApplications.applicantId, userId))
    .orderBy(desc(businessApplications.createdAt))
    .limit(1)

  if (!application) return null

  const timeline = await db
    .select({
      id: businessApplicationEvents.id,
      event: businessApplicationEvents.event,
      toStatus: businessApplicationEvents.toStatus,
      message: businessApplicationEvents.message,
      createdAt: businessApplicationEvents.createdAt,
    })
    .from(businessApplicationEvents)
    .where(
      and(
        eq(businessApplicationEvents.applicationId, application.id),
        eq(businessApplicationEvents.internal, false),
      ),
    )
    .orderBy(desc(businessApplicationEvents.createdAt))

  return { application, timeline }
}

/**
 * Answer a request for more information.
 *
 * Only allowed while NEEDS_INFORMATION, and only by the applicant. An
 * applicant cannot move their own application to APPROVED by any route - the
 * status written here is hard-coded, exactly as the sign-up role is.
 */
export async function resubmitApplication(params: {
  userId: string
  applicationId: string
  message: string
  updates?: { summary?: string; address?: string; whatsapp?: string; contactPhone?: string }
}) {
  const [application] = await db
    .select({
      id: businessApplications.id,
      status: businessApplications.status,
      applicantId: businessApplications.applicantId,
    })
    .from(businessApplications)
    .where(eq(businessApplications.id, params.applicationId))

  if (!application || application.applicantId !== params.userId) {
    throw new ApplicationError('NOT_FOUND', 'No such application.')
  }
  if (application.status !== 'NEEDS_INFORMATION') {
    throw new ApplicationError(
      'WRONG_STATUS',
      'This application is not waiting on you.',
    )
  }

  await db.transaction(async (tx) => {
    await tx
      .update(businessApplications)
      .set({
        ...(params.updates ?? {}),
        // HARD-CODED. An applicant cannot set their own status.
        status: 'UNDER_REVIEW',
        infoRequested: null,
        infoDueAt: null,
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(businessApplications.id, params.applicationId))

    await record(tx, {
      applicationId: params.applicationId,
      actorId: params.userId,
      event: 'RESUBMITTED',
      fromStatus: 'NEEDS_INFORMATION',
      toStatus: 'UNDER_REVIEW',
      message: params.message.trim() || null,
    })
  })
}

/** Businesses on the platform, for the directory. */
export async function listAllBusinesses() {
  return db
    .select({
      id: businesses.id,
      publicId: businesses.publicId,
      name: businesses.name,
      slug: businesses.slug,
      kind: businesses.kind,
      status: businesses.status,
      city: businesses.city,
      isFounding: businesses.isFounding,
      createdAt: businesses.createdAt,
      licenceNumber: businesses.licenceNumber,
      verifiedAt: businesses.verifiedAt,
    })
    .from(businesses)
    .where(isNull(businesses.deletedAt))
    .orderBy(businesses.publicId)
}

/**
 * Record that a business licence has been seen, or withdraw that record.
 *
 * WHAT THIS IS SAYING, AND THE CARE IT DESERVES. A customer reads the Verified
 * badge as "this business is real and can be traced if something goes wrong".
 * That is a promise Musuwo is making on a stranger's behalf, so it takes its
 * own permission - separate from approving, because letting somebody onboard
 * businesses is a smaller decision than letting them vouch for one - and it
 * requires a licence number rather than a tick box.
 *
 * A database CHECK enforces that verifiedAt, verifiedBy and licenceNumber
 * arrive together, so there is no path to a badge with nothing behind it.
 *
 * Withdrawing clears all three. It is not a soft flag: if the licence turns
 * out to be false, the claim has to disappear completely, and the audit log is
 * where the history of it lives.
 */
export async function setBusinessVerification(params: {
  businessId: string
  /** null withdraws verification. */
  licenceNumber: string | null
  documentPath?: string | null
  reason?: string
}): Promise<void> {
  const admin = await assertPermission('businesses.verify')

  const [existing] = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      verifiedAt: businesses.verifiedAt,
      licenceNumber: businesses.licenceNumber,
    })
    .from(businesses)
    .where(and(eq(businesses.id, params.businessId), isNull(businesses.deletedAt)))

  if (!existing) throw new ApplicationError('NOT_FOUND', 'No such business.')

  const licence = params.licenceNumber?.trim() || null

  if (licence !== null && licence.length < 3) {
    throw new ApplicationError(
      'NEEDS_REASON',
      'Put in the licence or registration number as it appears on the document. A badge with nothing behind it is worse than no badge.',
    )
  }

  await db.transaction(async (tx) => {
    await tx
      .update(businesses)
      .set(
        licence
          ? {
              licenceNumber: licence,
              licenceDocumentPath: params.documentPath ?? null,
              verifiedAt: new Date(),
              verifiedBy: admin.user.id,
              updatedAt: new Date(),
            }
          : {
              // All three together. A stale licence number left behind a
              // withdrawn badge is how the next reviewer re-verifies on the
              // strength of a document nobody has actually seen.
              licenceNumber: null,
              licenceDocumentPath: null,
              verifiedAt: null,
              verifiedBy: null,
              updatedAt: new Date(),
            },
      )
      .where(eq(businesses.id, params.businessId))

    await tx.insert(platformAuditLog).values({
      actorId: admin.user.id,
      actorRole: admin.role,
      action: licence ? 'BUSINESS_VERIFIED' : 'BUSINESS_VERIFICATION_WITHDRAWN',
      entityType: 'business',
      entityId: params.businessId,
      changes: {
        business: existing.name,
        from: existing.verifiedAt ? 'verified' : 'unverified',
        to: licence ? 'verified' : 'unverified',
        licenceNumber: licence,
      },
      reason: params.reason ?? null,
    })
  })

  // The badge is on the public directory, so drop the cached feeds.
  await invalidatePublicFeeds('all')
}

export interface PlatformOrder {
  id: string
  orderNumber: string
  status: string
  placedAt: Date | null
  recipientName: string
  deliverySuburb: string
  totalAmount: bigint
  currency: string
  merchantName: string | null
  merchantPublicId: string | null
}

/**
 * Every order on Musuwo, whichever merchant took it.
 *
 * THIS IS THE OTHER HALF OF THE ARRANGEMENT, and it is worth naming because it
 * is easy to get backwards. A customer on muroora-mart.vercel.app buys from
 * MUROORA MART: that is the name over the door, on the receipt and on the
 * delivery message, and Musuwo is not put in front of them while they shop.
 *
 * Underneath, the order belongs to the platform. It appears here the moment it
 * is placed, and Musuwo is what coordinates getting it to the customer. The
 * merchant packs; Musuwo delivers.
 *
 * So this deliberately does NOT filter by store, unlike `listOrdersForStaff`,
 * which is Muroora Mart's own screen and is scoped to Muroora Mart. The join
 * runs through `stores` to `businesses`, so an order shows the merchant that
 * took it rather than a store id nobody can read. A merchant with no business
 * row yields nulls rather than vanishing - an order that exists must never
 * disappear from the platform view because of a missing join.
 */
export async function listPlatformOrders(limit = 100): Promise<PlatformOrder[]> {
  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      placedAt: orders.placedAt,
      recipientName: orders.recipientName,
      deliverySuburb: orders.deliverySuburb,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      merchantName: businesses.name,
      merchantPublicId: businesses.publicId,
    })
    .from(orders)
    .leftJoin(businesses, eq(businesses.storeId, orders.storeId))
    .orderBy(desc(orders.placedAt))
    .limit(limit)

  return rows
}
