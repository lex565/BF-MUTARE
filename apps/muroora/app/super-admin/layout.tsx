import type { Metadata } from 'next'
import Link from 'next/link'

import { requirePlatformAdmin } from '@/lib/platform/auth'
import { countOpenApplications } from '@/lib/platform/applications'
import { SignOutButton } from '@/app/super-admin/SignOutButton'

import './control-center.css'

export const metadata: Metadata = {
  title: { default: 'Control Center', template: '%s - Musuwo Control Center' },
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * The Musuwo Control Center.
 *
 * WEB ONLY, by decision rather than by omission. §52 puts platform
 * administration in the browser and keeps it out of the customer app, and the
 * reason is worth stating: the app is installed on personal phones that get
 * lent, lost and handed to a shop assistant. Suspending a merchant should
 * require sitting down at a computer.
 *
 * THIS LAYOUT IS A GATE, NOT DECORATION. `requirePlatformAdmin` runs on every
 * request to every page beneath it, before anything renders. But it is the
 * outer gate only: each page checks its own permission again, and every action
 * checks a third time on the server. A layout that were the only check would
 * be defeated by anything that reaches a server action directly.
 *
 * Note what it does NOT do: it never says "you are not an administrator". An
 * unauthorised visitor is redirected to the same place a customer who typed
 * /admin lands, so the existence of this area is not confirmed to somebody
 * guessing at URLs.
 */

const navSections: {
  label: string
  items: { href: string; label: string; ownerOnly?: boolean }[]
}[] = [
  {
    label: 'Operations',
    items: [
      { href: '/super-admin', label: 'Overview' },
      { href: '/super-admin/applications', label: 'Applications' },
      { href: '/super-admin/businesses', label: 'Businesses' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { href: '/super-admin/audit', label: 'Audit log' },
      { href: '/super-admin/admins', label: 'Administrators', ownerOnly: true },
    ],
  },
]

export default async function ControlCenterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const admin = await requirePlatformAdmin()
  const open = await countOpenApplications()

  return (
    <div className="cc">
      <aside className="cc-rail">
        <Link href="/super-admin" className="cc-brand">
          <span className="cc-brand-mark" aria-hidden>◍</span>
          <span>
            <strong>Musuwo</strong>
            <em>Control Center</em>
          </span>
        </Link>

        <nav className="cc-nav">
          {navSections.map((section) => {
            const items = section.items.filter(
              (item) => !item.ownerOnly || admin.isOwner,
            )
            if (items.length === 0) return null
            return (
              <div key={section.label} className="cc-nav-group">
                <p className="cc-nav-label">{section.label}</p>
                {items.map((item) => (
                  <Link key={item.href} href={item.href} className="cc-nav-link">
                    <span>{item.label}</span>
                    {/* The queue count is the one number worth carrying in the
                        navigation: it is the only thing here that somebody is
                        waiting on a human for. */}
                    {item.href === '/super-admin/applications' && open > 0 && (
                      <span className="cc-count">{open}</span>
                    )}
                  </Link>
                ))}
              </div>
            )
          })}
        </nav>

        <div className="cc-who">
          <p className="cc-who-name">{admin.user.fullName ?? admin.user.email}</p>
          <p className={admin.isOwner ? 'cc-badge cc-badge-owner' : 'cc-badge'}>
            {admin.isOwner ? 'Platform Owner' : 'Super Admin'}
          </p>
          {!admin.isOwner && (
            <p className="cc-who-perms">
              {admin.permissions.length} permission
              {admin.permissions.length === 1 ? '' : 's'}
            </p>
          )}
          <SignOutButton />
        </div>
      </aside>

      <main className="cc-main">{children}</main>
    </div>
  )
}
