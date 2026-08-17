import { myBusinesses } from '@/lib/services/marketplace'
import { mobileFail, mobileOk, mobileOptions, mobileUser } from '../_lib'

export const dynamic = 'force-dynamic'
export const OPTIONS = mobileOptions

/**
 * The business workspaces this person may open.
 *
 * THE SERVER DECIDES. `myBusinesses` reads the membership table for the
 * signed-in user, so this can only ever return businesses they belong to.
 * The alternative - returning every business and letting the client show the
 * relevant ones - would ship the whole merchant list to every phone.
 *
 * Whatever the client then does with the result, every business-scoped route
 * re-checks membership through `requireMembership`. A business id chosen in a
 * switcher is a request, not a permission, and the switcher is not a security
 * boundary.
 */
export async function GET(request: Request) {
  const user = await mobileUser(request)
  if (!user) return mobileFail('UNAUTHENTICATED', 'Sign in again to continue.', 401)

  const workspaces = await myBusinesses(user.id)

  return mobileOk({
    // Platform roles and business roles are reported separately and must stay
    // that way. Holding ADMIN on the platform does not make somebody an admin
    // of any merchant, and owning a business does not confer platform rights.
    platformRoles: user.roles,
    workspaces: workspaces.map((w) => ({
      businessId: w.businessId,
      publicId: w.publicId,
      name: w.name,
      slug: w.slug,
      status: w.status,
      roles: w.roles,
      canWrite: w.canWrite,
      hasCatalogue: Boolean(w.storeId),
    })),
  })
}
