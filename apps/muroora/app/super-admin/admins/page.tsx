import {
  countActiveSuperAdmins,
  listAdmins,
  maxActiveSuperAdmins,
} from '@/lib/platform/admins'
import { requirePlatformOwner } from '@/lib/platform/auth'
import { AdminManager } from '@/app/super-admin/admins/AdminManager'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Administrators' }

/**
 * Owner only, and gated twice.
 *
 * The navigation hides this link from a Super Admin, and this page refuses
 * them anyway. The second check is the one that counts: the first is only a
 * tidy sidebar.
 */
export default async function AdminsPage() {
  await requirePlatformOwner()

  const [admins, activeCount, limit] = await Promise.all([
    listAdmins(),
    countActiveSuperAdmins(),
    maxActiveSuperAdmins(),
  ])

  return (
    <>
      <header className="cc-head">
        <p className="cc-eyebrow">Owner only</p>
        <h1 className="cc-title">Who helps you run Musuwo</h1>
        <p className="cc-sub">
          Only you can add or remove a Super Admin, and only you can change what
          one is allowed to do. A Super Admin cannot promote anybody, cannot
          grant themselves anything, and cannot touch this screen.
        </p>
      </header>

      <AdminManager admins={admins} activeCount={activeCount} limit={limit} />
    </>
  )
}
