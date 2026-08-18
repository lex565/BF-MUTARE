import { and, desc, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { users } from '@/db/schema/identity'
import {
  platformAuditLog,
  platformPermissions,
  platformRoles,
  platformSettings,
} from '@/db/schema/platform'
import { assertPlatformOwner } from '@/lib/platform/auth'
import {
  DEFAULT_REVIEWER_PERMISSIONS,
  isPermission,
  type PlatformPermission,
} from '@/lib/platform/permissions'

/**
 * Super Admin management. Owner only, every function.
 *
 * THE RULE THIS FILE ENFORCES, from §11 of the brief and §5 of the security
 * model: only the Platform Owner may create or remove a Super Admin, and no
 * Super Admin may grant themselves anything. Every function here begins with
 * `assertPlatformOwner`, which throws rather than redirects, because these are
 * called from actions and a redirect would look like success.
 *
 * There is no self-service route in or out. A Super Admin cannot promote
 * anybody, cannot edit their own permissions, and cannot touch the owner - not
 * because the screen hides those buttons, but because there is no function
 * here that a non-owner can complete.
 */

export class AdminError extends Error {
  constructor(
    public code: 'NOT_FOUND' | 'AT_LIMIT' | 'IS_OWNER' | 'BAD_PERMISSION' | 'NO_ACCOUNT',
    message: string,
  ) {
    super(message)
    this.name = 'AdminError'
  }
}

export interface AdminRow {
  platformRoleId: string
  userId: string
  name: string | null
  email: string | null
  role: 'PLATFORM_OWNER' | 'SUPER_ADMIN'
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED'
  grantedAt: Date
  grantedByName: string | null
  lastActiveAt: Date | null
  permissions: PlatformPermission[]
}

export async function maxActiveSuperAdmins(): Promise<number> {
  const [row] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, 'max_active_super_admins'))
  return Number(row?.value ?? 10)
}

/** Everybody who holds platform authority, owner included. */
export async function listAdmins(): Promise<AdminRow[]> {
  const rows = await db
    .select({
      platformRoleId: platformRoles.id,
      userId: platformRoles.userId,
      name: users.fullName,
      email: users.email,
      role: platformRoles.role,
      status: platformRoles.status,
      grantedAt: platformRoles.grantedAt,
      grantedById: platformRoles.grantedBy,
      lastActiveAt: platformRoles.lastActiveAt,
    })
    .from(platformRoles)
    .innerJoin(users, eq(users.id, platformRoles.userId))
    .orderBy(platformRoles.role, platformRoles.grantedAt)

  const perms = await db.select().from(platformPermissions)
  const byRole = new Map<string, PlatformPermission[]>()
  for (const p of perms) {
    const list = byRole.get(p.platformRoleId) ?? []
    list.push(p.permission as PlatformPermission)
    byRole.set(p.platformRoleId, list)
  }

  const granterIds = [...new Set(rows.map((r) => r.grantedById).filter(Boolean))]
  const granters = granterIds.length
    ? await db
        .select({ id: users.id, name: users.fullName })
        .from(users)
        .where(inArray(users.id, granterIds as string[]))
    : []
  const granterById = new Map(granters.map((g) => [g.id, g.name]))

  return rows.map((r) => ({
    platformRoleId: r.platformRoleId,
    userId: r.userId,
    name: r.name,
    email: r.email,
    role: r.role,
    status: r.status,
    grantedAt: r.grantedAt,
    grantedByName: r.grantedById ? (granterById.get(r.grantedById) ?? null) : null,
    lastActiveAt: r.lastActiveAt,
    permissions: byRole.get(r.platformRoleId) ?? [],
  }))
}

export async function countActiveSuperAdmins(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(platformRoles)
    .where(
      and(eq(platformRoles.role, 'SUPER_ADMIN'), eq(platformRoles.status, 'ACTIVE')),
    )
  return row.n
}

/**
 * Make an existing Musuwo account a Super Admin.
 *
 * PROMOTION, NOT INVITATION BY EMAIL, and that is a deliberate simplification
 * the brief allows in §9. An email invitation flow needs a token, an
 * expiry, an acceptance page and a way to handle the invitation being
 * forwarded - and until branded email is actually working, an invitation that
 * silently fails to arrive is worse than no invitation. Promoting an account
 * that already exists means the person has already proved they can receive
 * mail at that address, because they signed up with it.
 *
 * Everything §9 asks to be recorded is recorded: who granted it, when, with
 * what permissions, and in what state.
 */
export async function promoteToSuperAdmin(params: {
  email: string
  permissions?: string[]
}): Promise<{ platformRoleId: string; name: string | null }> {
  const owner = await assertPlatformOwner()
  const email = params.email.trim().toLowerCase()

  const requested = params.permissions ?? DEFAULT_REVIEWER_PERMISSIONS
  for (const p of requested) {
    if (!isPermission(p)) {
      throw new AdminError('BAD_PERMISSION', `There is no permission called "${p}".`)
    }
  }

  const [account] = await db
    .select({ id: users.id, name: users.fullName })
    .from(users)
    .where(eq(users.email, email))

  if (!account) {
    throw new AdminError(
      'NO_ACCOUNT',
      `Nobody has registered with ${email}. Ask them to create a Musuwo account first, then promote it here.`,
    )
  }

  const [existingOwner] = await db
    .select({ id: platformRoles.id })
    .from(platformRoles)
    .where(
      and(
        eq(platformRoles.userId, account.id),
        eq(platformRoles.role, 'PLATFORM_OWNER'),
      ),
    )
  if (existingOwner) {
    throw new AdminError(
      'IS_OWNER',
      'That account is the Platform Owner. It already has every permission.',
    )
  }

  const limit = await maxActiveSuperAdmins()
  const active = await countActiveSuperAdmins()
  if (active >= limit) {
    throw new AdminError(
      'AT_LIMIT',
      `Musuwo already has ${active} active Super Admins, which is the limit. Deactivate one before adding another.`,
    )
  }

  return db.transaction(async (tx) => {
    // Re-activating somebody who was deactivated keeps the original row, so
    // their history stays attached to one identity rather than fragmenting.
    const [existing] = await tx
      .select({ id: platformRoles.id })
      .from(platformRoles)
      .where(
        and(
          eq(platformRoles.userId, account.id),
          eq(platformRoles.role, 'SUPER_ADMIN'),
        ),
      )

    let roleId: string
    if (existing) {
      await tx
        .update(platformRoles)
        .set({
          status: 'ACTIVE',
          grantedBy: owner.user.id,
          grantedAt: new Date(),
          revokedAt: null,
          revokedBy: null,
          revokeReason: null,
          updatedAt: new Date(),
        })
        .where(eq(platformRoles.id, existing.id))
      roleId = existing.id
    } else {
      const [created] = await tx
        .insert(platformRoles)
        .values({
          userId: account.id,
          role: 'SUPER_ADMIN',
          status: 'ACTIVE',
          grantedBy: owner.user.id,
        })
        .returning({ id: platformRoles.id })
      roleId = created.id
    }

    await tx
      .delete(platformPermissions)
      .where(eq(platformPermissions.platformRoleId, roleId))

    if (requested.length) {
      await tx.insert(platformPermissions).values(
        requested.map((permission) => ({
          platformRoleId: roleId,
          permission,
          grantedBy: owner.user.id,
        })),
      )
    }

    await tx.insert(platformAuditLog).values({
      actorId: owner.user.id,
      actorRole: 'PLATFORM_OWNER',
      action: 'SUPER_ADMIN_GRANTED',
      entityType: 'platform_role',
      entityId: roleId,
      changes: { email, permissions: requested },
    })

    return { platformRoleId: roleId, name: account.name }
  })
}

/** Replace somebody's permissions wholesale. Owner only. */
export async function setPermissions(params: {
  platformRoleId: string
  permissions: string[]
}) {
  const owner = await assertPlatformOwner()

  for (const p of params.permissions) {
    if (!isPermission(p)) {
      throw new AdminError('BAD_PERMISSION', `There is no permission called "${p}".`)
    }
  }

  const [target] = await db
    .select({ role: platformRoles.role })
    .from(platformRoles)
    .where(eq(platformRoles.id, params.platformRoleId))

  if (!target) throw new AdminError('NOT_FOUND', 'No such administrator.')
  if (target.role === 'PLATFORM_OWNER') {
    throw new AdminError(
      'IS_OWNER',
      'The Platform Owner is not granted individual permissions. They hold all of them by being the owner, which is what makes it impossible to lock them out.',
    )
  }

  const before = await db
    .select({ permission: platformPermissions.permission })
    .from(platformPermissions)
    .where(eq(platformPermissions.platformRoleId, params.platformRoleId))

  await db.transaction(async (tx) => {
    await tx
      .delete(platformPermissions)
      .where(eq(platformPermissions.platformRoleId, params.platformRoleId))

    if (params.permissions.length) {
      await tx.insert(platformPermissions).values(
        params.permissions.map((permission) => ({
          platformRoleId: params.platformRoleId,
          permission,
          grantedBy: owner.user.id,
        })),
      )
    }

    await tx.insert(platformAuditLog).values({
      actorId: owner.user.id,
      actorRole: 'PLATFORM_OWNER',
      action: 'SUPER_ADMIN_PERMISSIONS_CHANGED',
      entityType: 'platform_role',
      entityId: params.platformRoleId,
      changes: {
        from: before.map((b) => b.permission),
        to: params.permissions,
      },
    })
  })
}

/**
 * Change somebody's status.
 *
 * Never deletes. The audit log points at the row and "who approved this
 * business last October" has to still resolve to a name next year.
 */
export async function setAdminStatus(params: {
  platformRoleId: string
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED'
  reason?: string
}) {
  const owner = await assertPlatformOwner()

  const [target] = await db
    .select({ role: platformRoles.role, status: platformRoles.status })
    .from(platformRoles)
    .where(eq(platformRoles.id, params.platformRoleId))

  if (!target) throw new AdminError('NOT_FOUND', 'No such administrator.')
  if (target.role === 'PLATFORM_OWNER') {
    throw new AdminError(
      'IS_OWNER',
      'The Platform Owner cannot be suspended from this screen. Transferring ownership is a migration, on purpose.',
    )
  }

  if (params.status === 'ACTIVE') {
    const limit = await maxActiveSuperAdmins()
    const active = await countActiveSuperAdmins()
    if (active >= limit) {
      throw new AdminError(
        'AT_LIMIT',
        `That would be ${active + 1} active Super Admins and the limit is ${limit}. Deactivate somebody first.`,
      )
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(platformRoles)
      .set({
        status: params.status,
        revokedBy: params.status === 'ACTIVE' ? null : owner.user.id,
        revokedAt: params.status === 'ACTIVE' ? null : new Date(),
        revokeReason: params.status === 'ACTIVE' ? null : (params.reason ?? null),
        updatedAt: new Date(),
      })
      .where(eq(platformRoles.id, params.platformRoleId))

    await tx.insert(platformAuditLog).values({
      actorId: owner.user.id,
      actorRole: 'PLATFORM_OWNER',
      action: `SUPER_ADMIN_${params.status}`,
      entityType: 'platform_role',
      entityId: params.platformRoleId,
      changes: { from: target.status, to: params.status },
      reason: params.reason ?? null,
    })
  })
}

/** The platform audit trail. Read by the owner, and by admins who may. */
export async function listPlatformAudit(limit = 100) {
  return db
    .select({
      id: platformAuditLog.id,
      action: platformAuditLog.action,
      entityType: platformAuditLog.entityType,
      entityId: platformAuditLog.entityId,
      changes: platformAuditLog.changes,
      reason: platformAuditLog.reason,
      createdAt: platformAuditLog.createdAt,
      actorName: users.fullName,
      actorEmail: users.email,
      actorRole: platformAuditLog.actorRole,
    })
    .from(platformAuditLog)
    .leftJoin(users, eq(users.id, platformAuditLog.actorId))
    .orderBy(desc(platformAuditLog.createdAt))
    .limit(limit)
}
