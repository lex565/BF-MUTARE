import type { Metadata } from 'next'
import Link from 'next/link'
import { eq } from 'drizzle-orm'

import { db } from '@/db/client'
import { staffProfiles, users } from '@/db/schema'
import { canViewAdmin, isAdmin, isViewerOnly, requireRole } from '@/lib/auth'
import { supabaseServer } from '@/lib/supabase/server'
import { format } from '@/lib/money'
import { getStaffDashboard } from '@/lib/services/dashboard'
import { staffSetupComplete } from '@/lib/services/staff-photo'
import { PasswordForm, PhotoForm, ProfileForm } from '@/app/staff/ProfileForms'

export const metadata: Metadata = {
  title: 'Staff',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

const timeOfDay = (d: Date) => {
  const h = d.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const when = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)

const dayAndTime = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)

/**
 * The staff welcome screen.
 *
 * Per the owner: a brief overview of what has been added, who the workers
 * are, when they signed in, and other statistics — plus somewhere to edit
 * their own profile.
 *
 * THE PHOTO GATE. "Staff cannot finish creating the account without the
 * picture." Their login works; what is withheld is the work. Until a photo is
 * on file this page shows the upload and nothing else, so the requirement is
 * not something to be scrolled past.
 */
export default async function StaffHomePage() {
  const me = await requireRole('SHOP_STAFF', 'ADMIN', 'SUPER_ADMIN', 'VIEWER')

  const [profileRow] = await db
    .select()
    .from(staffProfiles)
    .where(eq(staffProfiles.userId, me.id))

  const [userRow] = await db.select().from(users).where(eq(users.id, me.id))

  const setup = await staffSetupComplete(me.id)

  // When this session began, straight from the auth provider rather than
  // guessed from a cookie.
  const supabase = await supabaseServer()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  const signedInAt = authUser?.last_sign_in_at
    ? new Date(authUser.last_sign_in_at)
    : null

  const firstName = (me.fullName ?? '').split(' ')[0]
  const readOnly = isViewerOnly(me)

  /* ---------------------------------------------------- the photo gate */

  if (!setup.complete) {
    return (
      <main className="mx-auto max-w-[52rem] px-gutter py-16">
        <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
          Muroora Mart · Staff
        </p>
        <h1 className="mt-3 text-h1">
          {firstName ? `Almost there, ${firstName}` : 'Almost there'}
        </h1>

        <div className="mt-8 border-l-4 border-accent bg-paper-sunk p-6">
          <p className="font-bold">
            Your account is not finished yet.
          </p>
          <ul className="mt-3 space-y-1 text-ink-soft">
            {setup.missing.map((m) => (
              <li key={m}>· Still needed: {m}</li>
            ))}
          </ul>
        </div>

        {profileRow ? (
          <section className="mt-10">
            <h2 className="text-h3 font-bold">Add your photo</h2>
            <p className="mt-3 max-w-measure text-ink-soft">
              Every member of staff has a photo on file. It is how a customer
              at the door knows the person holding their shopping works here.
              Your staff tools open as soon as it is saved.
            </p>
            <PhotoForm hasPhoto={false} />
          </section>
        ) : (
          <section className="mt-10">
            <p className="max-w-measure text-ink-soft">
              You have signed in, but an admin has not added you to the staff
              list yet. Ask them to find your account on the People screen —
              they will need the email you signed up with:{' '}
              <span className="font-mono">{me.email}</span>
            </p>
          </section>
        )}
      </main>
    )
  }

  /* ------------------------------------------------------ the dashboard */

  const dash = await getStaffDashboard(me.id, signedInAt)

  return (
    <main className="mx-auto max-w-[86rem] px-gutter py-12">
      <header className="border-b border-rule pb-8">
        <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
          Muroora Mart · Staff
        </p>
        <h1 className="mt-3 text-h1">
          {timeOfDay(new Date())}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-4 max-w-measure text-ink-soft">
          You are <span className="font-mono">{profileRow!.staffNumber}</span>
          {profileRow!.jobTitle ? `, ${profileRow!.jobTitle}` : ''}
          {dash.signedInAt ? `. Signed in ${when(dash.signedInAt)}.` : '.'}
          {readOnly && (
            <>
              {' '}
              Your access is <strong>oversight only</strong> — you can see
              everything and change nothing.
            </>
          )}
        </p>
      </header>

      {/* ------------------------------------------------- statistics */}

      <section className="border-b border-rule py-10">
        <h2 className="text-h3 font-bold">Where things stand</h2>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: 'Orders waiting',
              value: dash.orders.waiting,
              note: 'not started yet',
            },
            {
              label: 'Being packed',
              value: dash.orders.beingPacked,
              note: 'somebody is on it',
            },
            {
              label: 'On the way',
              value: dash.orders.onTheWay,
              note: 'left the shop',
            },
            {
              label: 'Products on sale',
              value: dash.stock.products,
              note:
                dash.stock.lowOrOut > 0
                  ? `${dash.stock.lowOrOut} low or out`
                  : 'none running low',
              warn: dash.stock.lowOrOut > 0,
            },
          ].map((s) => (
            <div key={s.label} className="border border-rule p-6">
              <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
                {s.label}
              </p>
              <p
                className={`mt-2 text-mega leading-none ${s.warn ? 'text-accent' : ''}`}
              >
                {s.value}
              </p>
              <p className="mt-2 text-small text-ink-faint">{s.note}</p>
            </div>
          ))}
        </div>

        <dl className="mt-8 flex flex-wrap gap-x-12 gap-y-4 text-small">
          <div>
            <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
              Delivered so far
            </dt>
            <dd className="mt-1">
              {dash.orders.deliveredThisWeek === 0
                ? 'nothing yet'
                : `${dash.orders.deliveredThisWeek} orders`}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
              Value delivered
            </dt>
            <dd className="mt-1 font-mono tabular-nums">
              {dash.orders.takenThisWeek
                ? format(dash.orders.takenThisWeek)
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
              New products this week
            </dt>
            <dd className="mt-1">{dash.stock.addedThisWeek}</dd>
          </div>
          <div>
            <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
              Stock movements this week
            </dt>
            <dd className="mt-1">{dash.stock.movementsThisWeek}</dd>
          </div>
        </dl>
      </section>

      {/* ---------------------------------------------- what has changed */}

      <section className="border-b border-rule py-10">
        <h2 className="text-h3 font-bold">What has changed lately</h2>

        {dash.recent.length === 0 ? (
          <p className="mt-4 max-w-measure text-ink-soft">
            Nothing has been recorded in the last seven days.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-rule border-y border-rule">
            {dash.recent.map((r, i) => (
              <li key={i} className="flex flex-wrap gap-x-4 py-3 text-small">
                <span className="font-mono text-micro uppercase tracking-label text-ink-faint">
                  {dayAndTime(r.at)}
                </span>
                <span className="font-bold">{r.what}</span>
                {r.detail && <span className="text-ink-soft">{r.detail}</span>}
                {r.who && (
                  <span className="ml-auto text-ink-faint">by {r.who}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------- the team */}

      <section className="border-b border-rule py-10">
        <h2 className="text-h3 font-bold">Who is on the team</h2>

        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dash.team.map((c) => (
            <li key={c.staffNumber} className="border border-rule p-5">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-bold">{c.name}</span>
                {c.isYou && (
                  <span className="font-mono text-micro uppercase tracking-label text-support">
                    you
                  </span>
                )}
              </div>
              <p className="mt-1 font-mono text-micro text-ink-faint">
                {c.staffNumber}
              </p>
              {c.jobTitle && (
                <p className="mt-2 text-small text-ink-soft">{c.jobTitle}</p>
              )}
              <p className="mt-2 text-small text-ink-faint">
                {c.roles.length > 0 ? c.roles.join(', ') : 'no access yet'}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------------------------------------------- what to do */}

      <section className="border-b border-rule py-10">
        <h2 className="text-h3 font-bold">Your work</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <article className="border border-rule p-6">
            <h3 className="font-bold">Orders</h3>
            <p className="mt-2 text-small text-ink-soft">
              The queue to pick and pack. Coming next.
            </p>
          </article>

          {canViewAdmin(me) && (
            <>
              <article className="border border-rule p-6">
                <h3 className="font-bold">Products and stock</h3>
                <p className="mt-2 text-small text-ink-soft">
                  {readOnly
                    ? 'Look at what is on sale and what is running low.'
                    : 'Add products, adjust stock levels.'}
                </p>
                <Link
                  href="/admin/products"
                  className="mt-4 inline-block border border-ink px-4 py-2 font-mono text-micro uppercase tracking-label transition-colors hover:bg-ink hover:text-paper"
                >
                  Open
                </Link>
              </article>

              <article className="border border-rule p-6">
                <h3 className="font-bold">Delivery areas</h3>
                <p className="mt-2 text-small text-ink-soft">
                  Where the shop delivers and what it costs.
                </p>
                <Link
                  href="/admin/delivery"
                  className="mt-4 inline-block border border-ink px-4 py-2 font-mono text-micro uppercase tracking-label transition-colors hover:bg-ink hover:text-paper"
                >
                  Open
                </Link>
              </article>

              <article className="border border-rule p-6">
                <h3 className="font-bold">People</h3>
                <p className="mt-2 text-small text-ink-soft">
                  {readOnly
                    ? 'See who works here and what they may do.'
                    : 'Add a colleague or change what they may do.'}
                </p>
                <Link
                  href="/admin/staff"
                  className="mt-4 inline-block border border-ink px-4 py-2 font-mono text-micro uppercase tracking-label transition-colors hover:bg-ink hover:text-paper"
                >
                  Open
                </Link>
              </article>
            </>
          )}
        </div>

        {isAdmin(me) && (
          <p className="mt-6 max-w-measure text-small text-ink-faint">
            You have admin access. Only three accounts may have it at once.
          </p>
        )}
      </section>

      {/* ----------------------------------------------------- your details */}

      <section className="py-10">
        <h2 className="text-h3 font-bold">Your details</h2>
        <ProfileForm
          fullName={userRow?.fullName ?? ''}
          phone={userRow?.phone ?? ''}
          jobTitle={profileRow?.jobTitle ?? ''}
        />

        <div className="mt-10 border-t border-rule pt-8">
          <h3 className="font-bold">Your photo</h3>
          <p className="mt-2 max-w-measure text-small text-ink-soft">
            On file. Kept privately, never shown on the public site.
          </p>
          <PhotoForm hasPhoto />
        </div>

        <div className="mt-10 border-t border-rule pt-8">
          <h3 className="font-bold">Change your password</h3>
          <p className="mt-2 max-w-measure text-small text-ink-soft">
            Do this now if somebody else set the one you are using. Nobody
            else can see or change your password from anywhere in this system.
          </p>
          <PasswordForm />
        </div>
      </section>
    </main>
  )
}
