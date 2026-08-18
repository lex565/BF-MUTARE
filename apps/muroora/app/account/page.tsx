import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { currentUser, isAdmin, isStaff } from '@/lib/auth'
import { signOut } from '@/app/login/actions'
import { myBusinesses } from '@/lib/services/marketplace'

export const metadata: Metadata = {
  title: 'Your account',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * Where a signed-in person lands.
 *
 * Also where `requireRole` sends anyone who reached a page they may not open -
 * hence `?denied=1`. That redirect existed before this page did, which meant a
 * customer who typed /admin got a 404 and no explanation. A refusal should say
 * what happened and offer somewhere to go.
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>
}) {
  const user = await currentUser()
  if (!user) redirect('/login?next=/account')

  const { denied } = await searchParams
  const firstName = (user.fullName ?? '').split(' ')[0]
  const workspaces = await myBusinesses(user.id)

  return (
    <main className="mx-auto max-w-[52rem] px-gutter py-16">
      {denied && (
        <div
          role="alert"
          className="mb-10 border-l-4 border-accent bg-paper-sunk p-6"
        >
          <p className="font-bold">That page is not open to your account.</p>
          <p className="mt-2 text-small text-ink-soft">
            You are signed in, but this account does not have the access that
            page needs. If you work at Muroora Mart and should have it, ask an
            admin to add you on the People page.
          </p>
        </div>
      )}

      <header className="border-b border-rule pb-8">
        <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
          Your account
        </p>
        <h1 className="mt-3 text-h1">
          {firstName ? `Hello, ${firstName}` : 'Hello'}
        </h1>
        <p className="mt-4 text-ink-soft">
          Signed in as{' '}
          <span className="font-mono">{user.email ?? 'no email on file'}</span>.
        </p>
      </header>

      <section className="grid gap-4 py-10 sm:grid-cols-2">
        <Link
          href="/shop"
          className="border border-rule p-6 transition-colors hover:border-ink"
        >
          <h2 className="font-bold">Shop</h2>
          <p className="mt-2 text-small text-ink-soft">
            Browse what is in stock today.
          </p>
        </Link>

        <div className="border border-rule p-6">
          <h2 className="font-bold">Your orders</h2>
          <p className="mt-2 text-small text-ink-soft">
            Nothing here yet. Ordering opens once checkout is finished.
          </p>
        </div>

        {workspaces.map((business) => (
          <Link key={business.businessId} href={`/business/${business.businessId}`} className="border border-support p-6 transition-colors hover:bg-support hover:text-white">
            <h2 className="font-bold">{business.name}</h2>
            <p className="mt-2 text-small opacity-80">Business profile, products and Musuwo publishing.</p>
          </Link>
        ))}

        {isStaff(user) && (
          <Link
            href="/staff"
            className="border border-ink p-6 transition-colors hover:bg-ink hover:text-paper"
          >
            <h2 className="font-bold">Staff</h2>
            <p className="mt-2 text-small opacity-80">
              Your work screens.
            </p>
          </Link>
        )}

        {isAdmin(user) && (
          <Link
            href="/admin/products"
            className="border border-ink p-6 transition-colors hover:bg-ink hover:text-paper"
          >
            <h2 className="font-bold">Admin</h2>
            <p className="mt-2 text-small opacity-80">
              Products, stock and people.
            </p>
          </Link>
        )}
      </section>

      <form action={signOut} className="border-t border-rule pt-8">
        <button
          type="submit"
          className="border border-ink px-5 py-2 font-mono text-micro uppercase tracking-label transition-colors hover:bg-ink hover:text-paper"
        >
          Sign out
        </button>
      </form>
    </main>
  )
}
