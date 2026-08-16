import type { Metadata } from 'next'
import Link from 'next/link'
import { eq } from 'drizzle-orm'

import { db } from '@/db/client'
import { staffProfiles, users } from '@/db/schema'
import { requireRole } from '@/lib/auth'
import { StaffPhoto } from '@/app/components/StaffPhoto'
import { PasswordForm, PhotoForm, ProfileForm } from '@/app/staff/ProfileForms'

export const metadata: Metadata = {
  title: 'Your details',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * Your own details, on their own page.
 *
 * These forms used to sit at the bottom of the dashboard, below the
 * statistics, the recent changes and the whole team. Nobody scrolled that far,
 * and the owner said so: "i dont see where to edit". A thing people need to
 * find gets its own page and its own tile.
 */
export default async function StaffProfilePage() {
  const me = await requireRole('SHOP_STAFF', 'ADMIN', 'SUPER_ADMIN', 'VIEWER')

  const [profile] = await db
    .select()
    .from(staffProfiles)
    .where(eq(staffProfiles.userId, me.id))

  const [row] = await db.select().from(users).where(eq(users.id, me.id))

  return (
    <main className="mx-auto max-w-[52rem] px-gutter py-12">
      <header className="border-b border-rule pb-8">
        <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
          Muroora Mart · Staff
        </p>
        <h1 className="mt-3 text-h1">Your details</h1>

        <div className="mt-6 flex flex-wrap items-center gap-5">
          <StaffPhoto
            path={profile?.photoPath ?? null}
            name={row?.fullName ?? me.email ?? 'You'}
            viewerId={me.id}
            size={72}
          />
          <div>
            <p className="font-bold">{row?.fullName ?? 'Unnamed'}</p>
            <p className="mt-1 font-mono text-small text-ink-faint">
              {profile?.staffNumber ?? 'no staff number yet'}
            </p>
            <p className="mt-1 text-small text-ink-soft">
              {me.roles.filter((r) => r !== 'CUSTOMER').join(', ') ||
                'no staff access yet'}
            </p>
          </div>
          {profile && (
            <Link
              href="/staff/card"
              className="ml-auto border border-ink px-4 py-2 font-mono text-micro uppercase tracking-label transition-colors hover:bg-ink hover:text-paper"
            >
              Your staff card
            </Link>
          )}
        </div>
      </header>

      <section className="border-b border-rule py-10">
        <h2 className="text-h3 font-bold">Name and contact</h2>
        <ProfileForm
          fullName={row?.fullName ?? ''}
          phone={row?.phone ?? ''}
          jobTitle={profile?.jobTitle ?? ''}
        />
      </section>

      <section className="border-b border-rule py-10">
        <h2 className="text-h3 font-bold">Your photo</h2>
        <p className="mt-3 max-w-measure text-ink-soft">
          Kept privately. It appears on your staff card and to colleagues on
          the team list, and never on the public site.
        </p>
        <PhotoForm hasPhoto={Boolean(profile?.photoPath)} />
      </section>

      <section className="py-10">
        <h2 className="text-h3 font-bold">Password</h2>
        <p className="mt-3 max-w-measure text-ink-soft">
          Change it now if somebody else set the one you are using. Nobody else
          can see or change your password from anywhere in this system.
        </p>
        <PasswordForm />
      </section>

      <Link
        href="/staff"
        className="inline-block border border-rule px-5 py-2 font-mono text-micro uppercase tracking-label transition-colors hover:border-ink"
      >
        Back to dashboard
      </Link>
    </main>
  )
}
