import { and, eq, inArray } from 'drizzle-orm'
import { redirect } from 'next/navigation'

import { db } from '@/db/client'
import {
  platformPermissions,
  platformRoles,
  type platformRoleEnum,
} from '@/db/schema/platform'
import { currentUser, type CurrentUser } from '@/lib/auth'
import type { PlatformPermission } from '@/lib/platform/permissions'

/**
 * Who runs Musuwo, and what they may do.
 *
 * SEPARATE FROM lib/auth.ts ON PURPOSE. That file answers "what may this
 * person do inside Muroora Mart's shop" and every check in it is scoped to a
 * store. This one answers "what may this person do to the platform", which is
 * a different question about different rows in a different table. The two must
 * never be collapsed - see the long note at the top of db/schema/platform.ts
 * for what happens if they are.
 *
 * EVERY CHECK HERE IS A DATABASE READ, AND THAT IS THE POINT. The brief's §51
 * is right: `if (user.role === 'super_admin') show button` is not
 * authorisation, it is decoration. Hiding a button stops nobody from calling
 * the server action behind it. So the screens use these functions to decide
 * what to draw, AND every action calls them again before doing anything.
 */

export type PlatformRole = (typeof platformRoleEnum.enumValues)[number]

export interface PlatformAdmin {
  /** The application user, as lib/auth.ts sees them. */
  user: CurrentUser
  role: PlatformRole
  /** The `platform_roles` row id, which permissions hang off. */
  platformRoleId: string
  isOwner: boolean
  /**
   * Empty for the owner, and that is not a bug: they hold no permission rows
   * because they need none. Never read this to decide what the owner may do -
   * use `can()`, which answers true for them without consulting it.
   */
  permissions: PlatformPermission[]
}

/**
 * Resolve the signed-in person's platform authority, or null.
 *
 * Null covers every ordinary case: signed out, a customer, a rider, and - the
 * one worth naming - a Muroora Mart admin. Running the shop is not running the
 * platform, and four people hold shop admin today who should not, by default,
 * acquire authority over other merchants.
 *
 * INVITED, SUSPENDED and DEACTIVATED all resolve to null. Only ACTIVE counts,
 * so deactivating somebody takes effect on their very next request rather than
 * whenever a session happens to expire.
 */
export async function currentPlatformAdmin(): Promise<PlatformAdmin | null> {
  const user = await currentUser()
  if (!user) return null

  const [row] = await db
    .select({
      id: platformRoles.id,
      role: platformRoles.role,
    })
    .from(platformRoles)
    .where(
      and(
        eq(platformRoles.userId, user.id),
        eq(platformRoles.status, 'ACTIVE'),
        inArray(platformRoles.role, ['PLATFORM_OWNER', 'SUPER_ADMIN']),
      ),
    )

  if (!row) return null

  const isOwner = row.role === 'PLATFORM_OWNER'

  // The owner holds no permission rows by design, so do not go looking.
  const granted = isOwner
    ? []
    : await db
        .select({ permission: platformPermissions.permission })
        .from(platformPermissions)
        .where(eq(platformPermissions.platformRoleId, row.id))

  return {
    user,
    role: row.role,
    platformRoleId: row.id,
    isOwner,
    permissions: granted.map((p) => p.permission as PlatformPermission),
  }
}

/**
 * May this admin do this specific thing?
 *
 * The owner is allowed everything, answered here and nowhere else. That single
 * line is why the owner needs no permission rows and cannot be locked out of
 * their own platform by a revoked grant.
 */
export function can(
  admin: PlatformAdmin | null,
  permission: PlatformPermission,
): boolean {
  if (!admin) return false
  if (admin.isOwner) return true
  return admin.permissions.includes(permission)
}

/**
 * Gate a Control Center page on being an admin at all.
 *
 * Redirects rather than throwing, so somebody who lands on /super-admin by
 * following an old link gets their account page and not a stack trace. It does
 * NOT reveal that the area exists - the destination is the same one an
 * unauthorised shop visitor gets.
 */
export async function requirePlatformAdmin(): Promise<PlatformAdmin> {
  const admin = await currentPlatformAdmin()
  if (!admin) redirect('/account?denied=1')
  return admin
}

/**
 * Gate on a specific permission. This is the one most screens should use.
 *
 * Being in the Control Center is not permission to act inside it. A reviewer
 * granted only `business_applications.review` can open an application and is
 * refused by this function the moment they try to approve one, on the server,
 * whether or not the button was ever drawn.
 */
export async function requirePermission(
  permission: PlatformPermission,
): Promise<PlatformAdmin> {
  const admin = await requirePlatformAdmin()
  if (!can(admin, permission)) redirect('/super-admin?denied=1')
  return admin
}

/**
 * Gate on being the owner.
 *
 * Super Admin management, permission editing, ranking configuration and
 * platform settings. There is no permission that grants this - it is the one
 * boundary that cannot be delegated, which is what stops a Super Admin from
 * promoting themselves.
 */
export async function requirePlatformOwner(): Promise<PlatformAdmin> {
  const admin = await requirePlatformAdmin()
  if (!admin.isOwner) redirect('/super-admin?denied=1')
  return admin
}

/**
 * The same checks, for server actions and route handlers.
 *
 * `redirect()` is right for a page and wrong for an action: a POST that
 * redirects looks like success to anything that is not a browser. These throw
 * instead, so a caller has to deal with the refusal.
 */
export class PlatformAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlatformAuthError'
  }
}

export async function assertPermission(
  permission: PlatformPermission,
): Promise<PlatformAdmin> {
  const admin = await currentPlatformAdmin()
  if (!admin) {
    throw new PlatformAuthError('You are not a Musuwo administrator.')
  }
  if (!can(admin, permission)) {
    throw new PlatformAuthError(
      `Your account does not have the "${permission}" permission. Ask the Platform Owner.`,
    )
  }
  return admin
}

export async function assertPlatformOwner(): Promise<PlatformAdmin> {
  const admin = await currentPlatformAdmin()
  if (!admin?.isOwner) {
    throw new PlatformAuthError('Only the Platform Owner can do that.')
  }
  return admin
}
