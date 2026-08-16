import { and, eq, isNull } from 'drizzle-orm'
import { redirect } from 'next/navigation'

import { db } from '@/db/client'
import { userRoles, users } from '@/db/schema'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Who is asking, and what are they allowed to do.
 *
 * Two separate systems, joined here:
 *   - Supabase holds the LOGIN (email, password, session).
 *   - This application's `users` and `user_roles` tables hold the PERMISSIONS.
 *
 * Keeping them apart is what makes rule 7 of the brief enforceable: "A
 * customer must NEVER be able to register publicly and choose Shop Staff,
 * Admin, Rider or Super Admin." Signing up creates a Supabase login and a
 * CUSTOMER row here. Roles beyond that are granted by an existing admin,
 * writing to a table the signup path never touches.
 *
 * If roles lived in Supabase user metadata — which is the tempting shortcut —
 * they would be part of the object the client can see and, in some flows,
 * influence. They live in Postgres instead.
 */

export type Role =
  | 'CUSTOMER'
  | 'SHOP_STAFF'
  | 'ADMIN'
  | 'RIDER'
  | 'SUPER_ADMIN'
  | 'MERCHANT'
  | 'VIEWER'

export interface CurrentUser {
  id: string
  authId: string
  email: string | null
  fullName: string | null
  roles: Role[]
}

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID!

/**
 * The signed-in user, or null.
 *
 * Uses `getUser()`, never `getSession()`. `getSession()` reads the cookie and
 * trusts it; `getUser()` verifies the token with Supabase. On a server, where
 * the decision is "may this person edit prices", the cookie alone is not
 * evidence.
 */
export async function currentUser(): Promise<CurrentUser | null> {
  const supabase = await supabaseServer()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return null

  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.authId, authUser.id), isNull(users.deletedAt)))

  // Signed in with Supabase but no application row yet — first login after
  // signup. Create the row with no roles; CUSTOMER is granted by the signup
  // action, and nothing else is ever granted here.
  if (!row) {
    const [created] = await db
      .insert(users)
      .values({
        authId: authUser.id,
        email: authUser.email ?? null,
        fullName: (authUser.user_metadata?.full_name as string) ?? null,
      })
      .returning()

    return {
      id: created.id,
      authId: authUser.id,
      email: created.email,
      fullName: created.fullName,
      roles: [],
    }
  }

  const grants = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(and(eq(userRoles.userId, row.id), eq(userRoles.storeId, STORE_ID)))

  return {
    id: row.id,
    authId: authUser.id,
    email: row.email,
    fullName: row.fullName,
    roles: grants.map((g) => g.role as Role),
  }
}

export const hasRole = (user: CurrentUser | null, ...roles: Role[]): boolean =>
  Boolean(user && user.roles.some((r) => roles.includes(r)))

/**
 * Gate a page. Redirects rather than throwing, so an unauthorised visitor sees
 * a login screen rather than a stack trace.
 *
 * Always call this at the TOP of a protected page — not in a child component,
 * and never rely on the middleware alone. Middleware can be bypassed by
 * direct server-action invocation; this cannot.
 */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await currentUser()

  if (!user) {
    redirect('/login')
  }
  if (!hasRole(user, ...roles)) {
    redirect('/account?denied=1')
  }
  return user
}

/**
 * MAY CHANGE THINGS. SUPER_ADMIN implies ADMIN.
 *
 * VIEWER is deliberately absent. Read and write are two different questions
 * and the code has to ask them separately — see `canViewAdmin` below.
 */
export const isAdmin = (user: CurrentUser | null): boolean =>
  hasRole(user, 'ADMIN', 'SUPER_ADMIN')

/**
 * MAY LOOK AT THE ADMIN SCREENS. Includes read-only oversight.
 *
 * Use this to gate admin PAGES. Use `requireAdminWrite` in every action that
 * changes something. The split is the whole point of the VIEWER role: one
 * named person oversees the shop and edits nothing, and "oversees" is
 * worthless if it cannot see the numbers.
 */
export const canViewAdmin = (user: CurrentUser | null): boolean =>
  hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'VIEWER')

export const isStaff = (user: CurrentUser | null): boolean =>
  hasRole(user, 'SHOP_STAFF', 'ADMIN', 'SUPER_ADMIN', 'VIEWER')

/** Read-only oversight and nothing more. */
export const isViewerOnly = (user: CurrentUser | null): boolean =>
  hasRole(user, 'VIEWER') && !isAdmin(user) && !hasRole(user, 'SHOP_STAFF')

/** Gate an admin PAGE. Read-only oversight is allowed through. */
export const requireAdminView = () =>
  requireRole('ADMIN', 'SUPER_ADMIN', 'VIEWER')

/**
 * Gate an ACTION that changes something.
 *
 * Every admin server action calls this, never `requireAdminView`. A VIEWER
 * who reaches an action has either found a bug or is poking at it directly;
 * either way the answer is no.
 */
export const requireAdminWrite = () => requireRole('ADMIN', 'SUPER_ADMIN')
