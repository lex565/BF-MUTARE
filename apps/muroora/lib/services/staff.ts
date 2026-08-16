import { and, asc, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { auditLog, staffProfiles, userRoles, users } from '@/db/schema'
import type { Role } from '@/lib/auth'

/**
 * Staff service.
 *
 * Implements addendum §7: an employee creates an ordinary account, has no
 * privileges, and an admin promotes them. There is no self-service route to
 * staff access anywhere in this codebase, and no shared staff password -
 * every employee is a distinct account, so the audit log can name who picked
 * an order or changed a price.
 *
 * TWO SEPARATE FACTS, KEPT SEPARATE
 *
 *   `user_roles`     - what someone MAY DO. The security boundary.
 *   `staff_profiles` - who they ARE at work. Staff number, photo, status.
 *
 * Promotion writes both. Removing access writes only the first, because an
 * ex-employee's record has to outlive their login - otherwise last quarter's
 * order history points at nobody.
 */

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID!

/** Roles an admin may grant through the UI. */
export const GRANTABLE_ROLES = [
  'SHOP_STAFF',
  'ADMIN',
  'RIDER',
  'VIEWER',
] as const
export type GrantableRole = (typeof GRANTABLE_ROLES)[number]

/**
 * How many accounts may hold editing-admin power.
 *
 * The owner's instruction: "Only three owner-created admin accounts are
 * permitted; there must be no public admin registration."
 *
 * Counted as PEOPLE, not grants - somebody holding both ADMIN and SUPER_ADMIN
 * is one person and takes one place. VIEWER does not count, because a
 * read-only account cannot do the thing the limit exists to restrict.
 *
 * Enforced here AND by a trigger in migration 0005, so a psql session or a
 * future script cannot quietly make a fourth.
 */
export const MAX_ADMINS = 3

export interface StaffMember {
  userId: string
  profileId: string | null
  staffNumber: string | null
  fullName: string | null
  email: string | null
  phone: string | null
  jobTitle: string | null
  photoPath: string | null
  status: 'ACTIVE' | 'SUSPENDED' | 'LEFT' | null
  joinedAt: Date | null
  roles: Role[]
}

export class StaffError extends Error {
  constructor(
    readonly code:
      | 'NOT_FOUND'
      | 'ALREADY_STAFF'
      | 'LAST_ADMIN'
      | 'FORBIDDEN'
      | 'ADMIN_LIMIT'
      | 'NO_PHOTO',
    message: string,
  ) {
    super(message)
    this.name = 'StaffError'
  }
}

/* ------------------------------------------------------------------ reads */

/** Everyone with a staff profile, current and former. */
export async function listStaff(): Promise<StaffMember[]> {
  const rows = await db
    .select({
      userId: users.id,
      profileId: staffProfiles.id,
      staffNumber: staffProfiles.staffNumber,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      jobTitle: staffProfiles.jobTitle,
      photoPath: staffProfiles.photoPath,
      status: staffProfiles.status,
      joinedAt: staffProfiles.joinedAt,
    })
    .from(staffProfiles)
    .innerJoin(users, eq(staffProfiles.userId, users.id))
    .where(eq(staffProfiles.storeId, STORE_ID))
    .orderBy(asc(staffProfiles.staffNumber))

  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      roles: await rolesOf(row.userId),
    })),
  )
}

/**
 * Find an account to promote.
 *
 * Search, not a full list. The customer table will run to thousands and an
 * admin promoting a colleague already knows their email - offering a browsable
 * list of every customer is both useless and an unnecessary exposure of
 * personal data to anyone who reaches this screen.
 *
 * Requires at least three characters for the same reason.
 */
export async function findAccounts(query: string): Promise<StaffMember[]> {
  const term = query.trim()
  if (term.length < 3) return []

  const rows = await db
    .select({
      userId: users.id,
      profileId: staffProfiles.id,
      staffNumber: staffProfiles.staffNumber,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      jobTitle: staffProfiles.jobTitle,
      photoPath: staffProfiles.photoPath,
      status: staffProfiles.status,
      joinedAt: staffProfiles.joinedAt,
    })
    .from(users)
    .leftJoin(staffProfiles, eq(staffProfiles.userId, users.id))
    .where(
      and(
        isNull(users.deletedAt),
        or(
          ilike(users.email, `%${term}%`),
          ilike(users.fullName, `%${term}%`),
          ilike(users.phone, `%${term}%`),
        ),
      ),
    )
    .orderBy(desc(users.createdAt))
    .limit(20)

  return Promise.all(
    rows.map(async (row) => ({ ...row, roles: await rolesOf(row.userId) })),
  )
}

/**
 * How many people can reach the admin screens.
 *
 * Counts the ROLE, not the staff profile. Someone can hold ADMIN without
 * having been added to the staff list - the owner's own account starts that
 * way - and a screen that reported "Admins 0" to a signed-in admin would be
 * lying about the one number that matters for lockout.
 */
export async function countAdmins(): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(distinct ${userRoles.userId})::int` })
    .from(userRoles)
    .where(
      and(
        eq(userRoles.storeId, STORE_ID),
        or(eq(userRoles.role, 'ADMIN'), eq(userRoles.role, 'SUPER_ADMIN'))!,
      ),
    )
  return n
}

/**
 * Anyone holding a staff-side role who is not on the staff list.
 *
 * Usually just the owner, whose account was granted admin from the command
 * line before this screen existed. Worth showing rather than hiding: an
 * account with admin rights and no record of who it belongs to is exactly the
 * thing an audit would ask about.
 */
export async function listUnrecordedAccess(): Promise<StaffMember[]> {
  const rows = await db
    .select({
      userId: users.id,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
    })
    .from(userRoles)
    .innerJoin(users, eq(userRoles.userId, users.id))
    .leftJoin(staffProfiles, eq(staffProfiles.userId, users.id))
    .where(
      and(
        eq(userRoles.storeId, STORE_ID),
        isNull(staffProfiles.id),
        isNull(users.deletedAt),
        sql`${userRoles.role} <> 'CUSTOMER'`,
      ),
    )

  const seen = new Map<string, StaffMember>()
  for (const row of rows) {
    if (seen.has(row.userId)) continue
    seen.set(row.userId, {
      ...row,
      profileId: null,
      staffNumber: null,
      jobTitle: null,
      photoPath: null,
      status: null,
      joinedAt: null,
      roles: await rolesOf(row.userId),
    })
  }
  return [...seen.values()]
}

async function rolesOf(userId: string): Promise<Role[]> {
  const rows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.storeId, STORE_ID)))
  return rows.map((r) => r.role as Role)
}

/* ----------------------------------------------------------------- writes */

/**
 * Promote an existing account.
 *
 * Grants the role AND creates the staff profile if there is not one, in a
 * single transaction. The staff number comes from the database default, so
 * two admins promoting at the same moment cannot collide.
 */
export async function promoteToStaff(
  params: {
    userId: string
    role: GrantableRole
    jobTitle?: string
  },
  actorId: string,
): Promise<{ staffNumber: string }> {
  const [target] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(eq(users.id, params.userId), isNull(users.deletedAt)))

  if (!target) {
    throw new StaffError('NOT_FOUND', 'No such account.')
  }

  /**
   * The three-admin limit, checked before anything is written.
   *
   * Someone who is ALREADY an admin can be granted admin again without
   * consuming a place - that is a no-op, and refusing it would be confusing.
   * The database trigger is the real backstop; this exists so the admin gets
   * a sentence instead of a Postgres exception.
   */
  if (params.role === 'ADMIN') {
    const alreadyAdmin = (await rolesOf(params.userId)).some(
      (r) => r === 'ADMIN' || r === 'SUPER_ADMIN',
    )
    if (!alreadyAdmin) {
      const current = await countAdmins()
      if (current >= MAX_ADMINS) {
        throw new StaffError(
          'ADMIN_LIMIT',
          `Only ${MAX_ADMINS} accounts may have admin access, and there are ` +
            `already ${current}. Remove one first, or give this person ` +
            `oversight instead - that sees everything and changes nothing.`,
        )
      }
    }
  }

  return db.transaction(async (tx) => {
    const existingRole = await tx
      .select()
      .from(userRoles)
      .where(
        and(
          eq(userRoles.userId, params.userId),
          eq(userRoles.role, params.role),
          eq(userRoles.storeId, STORE_ID),
        ),
      )

    if (existingRole.length === 0) {
      await tx.insert(userRoles).values({
        userId: params.userId,
        role: params.role,
        storeId: STORE_ID,
        grantedBy: actorId,
      })
    }

    const [existingProfile] = await tx
      .select()
      .from(staffProfiles)
      .where(eq(staffProfiles.userId, params.userId))

    let staffNumber: string

    if (existingProfile) {
      // Somebody returning, or being given a second role. Reactivate rather
      // than issue a new number - their history belongs to the old one.
      staffNumber = existingProfile.staffNumber
      await tx
        .update(staffProfiles)
        .set({
          status: 'ACTIVE',
          leftAt: null,
          jobTitle: params.jobTitle ?? existingProfile.jobTitle,
          updatedAt: new Date(),
        })
        .where(eq(staffProfiles.id, existingProfile.id))
    } else {
      const [created] = await tx
        .insert(staffProfiles)
        .values({
          storeId: STORE_ID,
          userId: params.userId,
          jobTitle: params.jobTitle ?? null,
          status: 'ACTIVE',
          createdBy: actorId,
          // staffNumber omitted on purpose - the column default calls
          // next_staff_number(), which is atomic.
        } as never)
        .returning({ staffNumber: staffProfiles.staffNumber })
      staffNumber = created.staffNumber
    }

    await tx.insert(auditLog).values({
      storeId: STORE_ID,
      actorId,
      actorRole: 'ADMIN',
      action: 'STAFF_PROMOTED',
      entityType: 'user',
      entityId: params.userId,
      changes: {
        role: params.role,
        staffNumber,
        email: target.email,
        jobTitle: params.jobTitle ?? null,
      },
    })

    return { staffNumber }
  })
}

/**
 * Remove a role.
 *
 * REFUSES TO REMOVE THE LAST ADMIN. Locking everyone out of the admin screens
 * would need database access to undo, and the person most likely to try this
 * is an admin tidying up their own duplicate role at the end of a long day.
 */
export async function revokeRole(
  params: { userId: string; role: GrantableRole },
  actorId: string,
): Promise<void> {
  if (params.role === 'ADMIN') {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(userRoles)
      .where(
        and(eq(userRoles.role, 'ADMIN'), eq(userRoles.storeId, STORE_ID)),
      )

    if (n <= 1) {
      throw new StaffError(
        'LAST_ADMIN',
        'This is the only admin account. Promote somebody else first, or ' +
          'nobody will be able to reach the admin screens.',
      )
    }
  }

  await db
    .delete(userRoles)
    .where(
      and(
        eq(userRoles.userId, params.userId),
        eq(userRoles.role, params.role),
        eq(userRoles.storeId, STORE_ID),
      ),
    )

  await db.insert(auditLog).values({
    storeId: STORE_ID,
    actorId,
    actorRole: 'ADMIN',
    action: 'ROLE_REVOKED',
    entityType: 'user',
    entityId: params.userId,
    changes: { role: params.role },
  })
}

/**
 * Change employment status.
 *
 * Setting LEFT or SUSPENDED also strips staff and rider roles, because the HR
 * fact and the access fact should not be able to disagree - a suspended
 * employee who can still pick orders is exactly the gap this closes.
 * The profile itself is kept, so their history still has a name against it.
 */
export async function setStaffStatus(
  params: {
    userId: string
    status: 'ACTIVE' | 'SUSPENDED' | 'LEFT'
    notes?: string
  },
  actorId: string,
): Promise<void> {
  const [profile] = await db
    .select()
    .from(staffProfiles)
    .where(eq(staffProfiles.userId, params.userId))

  if (!profile) throw new StaffError('NOT_FOUND', 'No staff record for them.')

  if (params.status !== 'ACTIVE') {
    const roles = await rolesOf(params.userId)
    if (roles.includes('ADMIN')) {
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(userRoles)
        .where(
          and(eq(userRoles.role, 'ADMIN'), eq(userRoles.storeId, STORE_ID)),
        )
      if (n <= 1) {
        throw new StaffError(
          'LAST_ADMIN',
          'They are the only admin. Promote somebody else first.',
        )
      }
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(staffProfiles)
      .set({
        status: params.status,
        leftAt: params.status === 'LEFT' ? new Date() : null,
        notes: params.notes ?? profile.notes,
        updatedAt: new Date(),
      })
      .where(eq(staffProfiles.id, profile.id))

    if (params.status !== 'ACTIVE') {
      for (const role of ['SHOP_STAFF', 'RIDER', 'ADMIN'] as const) {
        await tx
          .delete(userRoles)
          .where(
            and(
              eq(userRoles.userId, params.userId),
              eq(userRoles.role, role),
              eq(userRoles.storeId, STORE_ID),
            ),
          )
      }
    }

    await tx.insert(auditLog).values({
      storeId: STORE_ID,
      actorId,
      actorRole: 'ADMIN',
      action: 'STAFF_STATUS_CHANGED',
      entityType: 'user',
      entityId: params.userId,
      changes: {
        from: profile.status,
        to: params.status,
        rolesStripped: params.status !== 'ACTIVE',
      },
    })
  })
}

/** Update the details that are not permissions. */
export async function updateStaffProfile(
  params: { userId: string; jobTitle?: string; notes?: string },
  actorId: string,
): Promise<void> {
  const [profile] = await db
    .select()
    .from(staffProfiles)
    .where(eq(staffProfiles.userId, params.userId))

  if (!profile) throw new StaffError('NOT_FOUND', 'No staff record for them.')

  await db
    .update(staffProfiles)
    .set({
      jobTitle: params.jobTitle ?? profile.jobTitle,
      notes: params.notes ?? profile.notes,
      updatedAt: new Date(),
    })
    .where(eq(staffProfiles.id, profile.id))

  await db.insert(auditLog).values({
    storeId: STORE_ID,
    actorId,
    actorRole: 'ADMIN',
    action: 'STAFF_PROFILE_UPDATED',
    entityType: 'user',
    entityId: params.userId,
    changes: { jobTitle: params.jobTitle, notes: params.notes },
  })
}
