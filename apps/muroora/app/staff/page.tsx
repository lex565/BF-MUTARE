import type { Metadata } from 'next'
import Link from 'next/link'

import { db } from '@/db/client'
import { staffProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { isAdmin, requireRole } from '@/lib/auth'
import { countLowStock } from '@/lib/services/products'

export const metadata: Metadata = {
  title: 'Staff',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * What an employee sees when they sign in.
 *
 * Gated on SHOP_STAFF as well as ADMIN, because this is the screen the shop
 * floor uses and admins are a superset, not a separate audience. A customer who
 * types /staff is redirected the same way they are on /admin.
 *
 * The order queue lands here as OPS-01, once orders can be created. Until then
 * this says so rather than showing an empty table that looks broken.
 */
export default async function StaffHomePage() {
  const me = await requireRole('SHOP_STAFF', 'ADMIN', 'SUPER_ADMIN')

  const [profile] = await db
    .select()
    .from(staffProfiles)
    .where(eq(staffProfiles.userId, me.id))

  const lowCount = await countLowStock()

  const firstName = (me.fullName ?? '').split(' ')[0]

  return (
    <main className="mx-auto max-w-[70rem] px-gutter py-12">
      <header className="border-b border-rule pb-8">
        <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
          Muroora Mart · Staff
        </p>
        <h1 className="mt-3 text-h1">
          {firstName ? `Hello, ${firstName}` : 'Hello'}
        </h1>
        <p className="mt-4 max-w-measure text-ink-soft">
          {profile?.staffNumber ? (
            <>
              You are signed in as{' '}
              <span className="font-mono">{profile.staffNumber}</span>
              {profile.jobTitle ? `, ${profile.jobTitle}.` : '.'}
            </>
          ) : (
            <>
              You have staff access but no staff record yet. Ask an admin to add
              you on the People page so your work is recorded under your name.
            </>
          )}
        </p>
      </header>

      <section className="grid gap-6 py-10 sm:grid-cols-2">
        <article className="border border-rule p-6">
          <h2 className="text-h3 font-bold">Orders</h2>
          <p className="mt-3 text-small text-ink-soft">
            The queue of orders to pick and pack lands here. It is not built
            yet: customers cannot place an order until checkout is finished, so
            there is nothing to queue.
          </p>
          <p className="mt-4 font-mono text-micro uppercase tracking-label text-ink-faint">
            Coming next
          </p>
        </article>

        <article className="border border-rule p-6">
          <h2 className="text-h3 font-bold">Stock</h2>
          <p className="mt-3 text-small text-ink-soft">
            {lowCount === 0
              ? 'Nothing is running low.'
              : `${lowCount} ${lowCount === 1 ? 'item is' : 'items are'} low or out of stock.`}
          </p>
          {isAdmin(me) ? (
            <Link
              href="/admin/products"
              className="mt-4 inline-block border border-ink px-4 py-2 font-mono text-micro uppercase tracking-label transition-colors hover:bg-ink hover:text-paper"
            >
              Open products
            </Link>
          ) : (
            <p className="mt-4 font-mono text-micro uppercase tracking-label text-ink-faint">
              Ask an admin to adjust stock
            </p>
          )}
        </article>

        {isAdmin(me) && (
          <article className="border border-rule p-6">
            <h2 className="text-h3 font-bold">Delivery areas</h2>
            <p className="mt-3 text-small text-ink-soft">
              Where you deliver and what it costs. Nothing can be ordered until
              at least one area is set up.
            </p>
            <Link
              href="/admin/delivery"
              className="mt-4 inline-block border border-ink px-4 py-2 font-mono text-micro uppercase tracking-label transition-colors hover:bg-ink hover:text-paper"
            >
              Open delivery areas
            </Link>
          </article>
        )}

        {isAdmin(me) && (
          <article className="border border-rule p-6">
            <h2 className="text-h3 font-bold">People</h2>
            <p className="mt-3 text-small text-ink-soft">
              Add a colleague, change what someone is allowed to do, or record
              that they have left.
            </p>
            <Link
              href="/admin/staff"
              className="mt-4 inline-block border border-ink px-4 py-2 font-mono text-micro uppercase tracking-label transition-colors hover:bg-ink hover:text-paper"
            >
              Open people
            </Link>
          </article>
        )}
      </section>
    </main>
  )
}
