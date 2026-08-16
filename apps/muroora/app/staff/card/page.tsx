import type { Metadata } from 'next'
import Link from 'next/link'
import { and, eq } from 'drizzle-orm'

import { db } from '@/db/client'
import { staffProfiles, userRoles, users } from '@/db/schema'
import { canViewAdmin, requireRole } from '@/lib/auth'
import { StaffPhoto } from '@/app/components/StaffPhoto'

export const metadata: Metadata = {
  title: 'Staff card',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Management',
  ADMIN: 'Management',
  SHOP_STAFF: 'Shop staff',
  RIDER: 'Delivery rider',
  VIEWER: 'Oversight',
}

/**
 * The staff card.
 *
 * Addendum §8 asks for a generated Muroora staff ID with a photo, name, role,
 * status and joined date, and says printable cards can come later. This is
 * that card on screen, laid out at the proportions of a real ID badge, and it
 * prints — `@media print` strips everything around it.
 *
 * WHAT IS DELIBERATELY NOT ON IT: no email, no phone, no home address. A card
 * gets left on counters and photographed. It answers "does this person work
 * here", and nothing else. The staff number is the handle for anything more,
 * and looking that up needs an account.
 *
 * An admin may view anybody's; everyone else sees only their own.
 */
export default async function StaffCardPage({
  searchParams,
}: {
  searchParams: Promise<{ staff?: string }>
}) {
  const me = await requireRole('SHOP_STAFF', 'ADMIN', 'SUPER_ADMIN', 'VIEWER')
  const { staff } = await searchParams

  const wantsSomeoneElse = Boolean(staff)
  if (wantsSomeoneElse && !canViewAdmin(me)) {
    // Not an error page: they simply get their own.
  }

  const lookup =
    wantsSomeoneElse && canViewAdmin(me)
      ? eq(staffProfiles.staffNumber, staff!)
      : eq(staffProfiles.userId, me.id)

  const [row] = await db
    .select({
      staffNumber: staffProfiles.staffNumber,
      jobTitle: staffProfiles.jobTitle,
      photoPath: staffProfiles.photoPath,
      status: staffProfiles.status,
      joinedAt: staffProfiles.joinedAt,
      userId: staffProfiles.userId,
      fullName: users.fullName,
    })
    .from(staffProfiles)
    .innerJoin(users, eq(staffProfiles.userId, users.id))
    .where(lookup)

  if (!row) {
    return (
      <main className="mx-auto max-w-[40rem] px-gutter py-16">
        <h1 className="text-h1">No card yet</h1>
        <p className="mt-4 text-ink-soft">
          {wantsSomeoneElse
            ? 'No staff member with that number.'
            : 'You do not have a staff record yet. An admin has to add you on the People screen first.'}
        </p>
        <Link
          href="/staff"
          className="mt-8 inline-block border border-ink px-5 py-2 font-mono text-micro uppercase tracking-label transition-colors hover:bg-ink hover:text-paper"
        >
          Back to dashboard
        </Link>
      </main>
    )
  }

  const grants = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(
      and(
        eq(userRoles.userId, row.userId),
        eq(userRoles.storeId, process.env.NEXT_PUBLIC_STORE_ID!),
      ),
    )

  // One label, not a list. A card saying "ADMIN, SHOP_STAFF, CUSTOMER" tells a
  // customer at the door nothing and tells a thief something. Highest first.
  const rank = ['SUPER_ADMIN', 'ADMIN', 'SHOP_STAFF', 'RIDER', 'VIEWER']
  const primary =
    rank.find((r) => grants.some((g) => g.role === r)) ?? null

  const joined = new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    year: 'numeric',
  }).format(row.joinedAt)

  return (
    <main className="mx-auto max-w-[52rem] px-gutter py-12">
      <div className="print:hidden">
        <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
          Muroora Mart · Staff
        </p>
        <h1 className="mt-3 text-h1">Staff card</h1>
        <p className="mt-4 max-w-measure text-ink-soft">
          Proof that this person works here. It carries no phone number, email
          or address on purpose — a card gets left on counters and
          photographed. Anything beyond &ldquo;they work here&rdquo; needs the
          staff number and an account.
        </p>
      </div>

      {/* The card. 85.6 x 54 mm is a real ID card; this holds that ratio. */}
      <article className="mt-8 w-full max-w-[26rem] border-2 border-ink bg-paper print:mt-0 print:border">
        <header className="flex items-center justify-between border-b border-ink bg-ink px-5 py-3 text-paper print:bg-white print:text-ink">
          <span className="font-display text-h4 font-bold leading-none">
            Muroora Mart
          </span>
          <span className="font-mono text-micro uppercase tracking-label opacity-80">
            Staff
          </span>
        </header>

        <div className="flex gap-5 p-5">
          <StaffPhoto
            path={row.photoPath}
            name={row.fullName ?? row.staffNumber}
            viewerId={me.id}
            size={104}
          />

          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-h4 font-bold leading-tight">
              {row.fullName ?? 'Unnamed'}
            </p>
            <p className="mt-1 font-mono text-micro uppercase tracking-label text-accent">
              {primary ? (ROLE_LABEL[primary] ?? primary) : 'No access'}
            </p>
            {row.jobTitle && (
              <p className="mt-1 truncate text-small text-ink-soft">
                {row.jobTitle}
              </p>
            )}

            <dl className="mt-4 space-y-2">
              <div>
                <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                  Staff number
                </dt>
                <dd className="font-mono text-small tabular-nums">
                  {row.staffNumber}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                  Since
                </dt>
                <dd className="font-mono text-small">{joined}</dd>
              </div>
            </dl>
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-rule px-5 py-3">
          <span
            className={`font-mono text-micro uppercase tracking-label ${
              row.status === 'ACTIVE' ? 'text-support' : 'text-accent'
            }`}
          >
            {row.status === 'ACTIVE' ? 'Current employee' : `Not current · ${row.status}`}
          </span>
          <span className="font-mono text-[0.6rem] text-ink-faint">
            muroora-mart.vercel.app
          </span>
        </footer>
      </article>

      <div className="mt-8 flex flex-wrap gap-4 print:hidden">
        <Link
          href="/staff"
          className="border border-rule px-5 py-2 font-mono text-micro uppercase tracking-label transition-colors hover:border-ink"
        >
          Back to dashboard
        </Link>
        {canViewAdmin(me) && (
          <Link
            href="/admin/staff"
            className="border border-rule px-5 py-2 font-mono text-micro uppercase tracking-label transition-colors hover:border-ink"
          >
            Everyone&rsquo;s cards
          </Link>
        )}
      </div>

      {row.status !== 'ACTIVE' && (
        <p className="mt-6 max-w-measure text-small text-accent print:hidden">
          This person is marked {row.status.toLowerCase()}. The card says so,
          rather than being deleted, so an old card found later can be checked
          against the record.
        </p>
      )}
    </main>
  )
}
