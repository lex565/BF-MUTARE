import Link from 'next/link'

import { canViewAdmin, currentUser, isStaff, isViewerOnly } from '@/lib/auth'
import { signOut } from '@/app/login/actions'

/**
 * The staff strip.
 *
 * Renders ONLY for signed-in staff. A customer, and anybody signed out, gets
 * nothing at all — not a hidden element, not a collapsed bar; the component
 * returns null and no markup reaches the page. The approved customer design is
 * therefore untouched, which is the whole reason this sits above the layout
 * rather than inside the nav.
 *
 * It exists because the staff side was reachable only by typing URLs. Somebody
 * packing orders should not have to remember `/admin/delivery`.
 *
 * This is convenience, NOT a security boundary. Every destination re-checks the
 * role on arrival with `requireRole`. Hiding a link has never stopped anybody
 * from visiting the URL.
 */
export async function StaffBar() {
  const user = await currentUser()
  if (!isStaff(user)) return null

  const admin = canViewAdmin(user)
  const readOnly = isViewerOnly(user)
  const firstName = (user!.fullName ?? user!.email ?? '').split(' ')[0]

  const links = [
    { href: '/staff', label: 'Dashboard' },
    ...(admin
      ? [
          { href: '/admin/products', label: 'Products' },
          { href: '/admin/delivery', label: 'Delivery' },
          { href: '/admin/staff', label: 'People' },
        ]
      : []),
  ]

  return (
    <div className="border-b border-ink/20 bg-ink text-paper">
      <div className="mx-auto flex max-w-[86rem] flex-wrap items-center gap-x-6 gap-y-2 px-gutter py-2">
        <span className="font-mono text-micro uppercase tracking-label text-paper/60">
          Staff
        </span>

        <nav aria-label="Staff" className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-mono text-micro uppercase tracking-label text-paper/85 transition-colors hover:text-paper"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {readOnly && (
          <span className="font-mono text-micro uppercase tracking-label text-paper/50">
            view only
          </span>
        )}

        <div className="ml-auto flex items-center gap-4">
          {firstName && (
            <span className="font-mono text-micro text-paper/60">
              {firstName}
            </span>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="font-mono text-micro uppercase tracking-label text-paper/60 transition-colors hover:text-paper"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
