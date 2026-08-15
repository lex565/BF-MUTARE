import type { Metadata } from 'next'

import { requireRole } from '@/lib/auth'
import {
  countAdmins,
  listStaff,
  listUnrecordedAccess,
} from '@/lib/services/staff'
import { PromoteForm } from '@/app/admin/staff/PromoteForm'
import { StaffRowActions } from '@/app/admin/staff/StaffRowActions'

export const metadata: Metadata = {
  title: 'People',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

const STATUS_LABEL = {
  ACTIVE: 'Working',
  SUSPENDED: 'Suspended',
  LEFT: 'Left',
} as const

export default async function AdminStaffPage() {
  const me = await requireRole('ADMIN', 'SUPER_ADMIN')

  const [staff, adminCount, unrecorded] = await Promise.all([
    listStaff(),
    countAdmins(),
    listUnrecordedAccess(),
  ])

  const working = staff.filter((s) => s.status === 'ACTIVE')

  return (
    <main className="mx-auto max-w-[86rem] px-gutter py-12">
      <header className="border-b border-rule pb-8">
        <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
          Admin
        </p>
        <h1 className="mt-3 text-h1">People</h1>
        <p className="mt-4 max-w-measure text-ink-soft">
          Who works here and what each of them is allowed to do. Nobody gets
          staff access by signing up — an employee makes an ordinary account
          with their own password, then you give that account the access it
          needs from this page.
        </p>

        <dl className="mt-8 flex flex-wrap gap-x-12 gap-y-4">
          <div>
            <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
              Working now
            </dt>
            <dd className="mt-1 text-h3 font-bold">{working.length}</dd>
          </div>
          <div>
            <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
              On record
            </dt>
            <dd className="mt-1 text-h3 font-bold">{staff.length}</dd>
          </div>
          <div>
            <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
              Admins
            </dt>
            <dd className="mt-1 text-h3 font-bold">{adminCount}</dd>
          </div>
        </dl>

        {unrecorded.length > 0 && (
          <div className="mt-8 max-w-measure border-l-4 border-accent bg-paper-sunk p-6">
            <p className="font-bold">
              {unrecorded.length === 1
                ? 'One account has access but is not on the staff list.'
                : `${unrecorded.length} accounts have access but are not on the staff list.`}
            </p>
            <ul className="mt-3 space-y-1 text-small text-ink-soft">
              {unrecorded.map((person) => (
                <li key={person.userId}>
                  <span className="font-mono">
                    {person.email ?? person.phone ?? person.userId}
                  </span>{' '}
                  — {person.roles.filter((r) => r !== 'CUSTOMER').join(', ')}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-small text-ink-soft">
              This is normal for the first admin account, which was granted
              before this page existed. Search for it below and grant it a role
              here to give it a staff number and a record.
            </p>
          </div>
        )}
      </header>

      <section className="border-b border-rule py-10">
        <h2 className="text-h3 font-bold">Give someone access</h2>
        <p className="mt-3 max-w-measure text-ink-soft">
          They sign up at the normal login page first. Then find their account
          here and choose what they may do. Their password stays theirs — you
          never see it, and there is no shared staff login.
        </p>
        <PromoteForm />
      </section>

      <section className="py-10">
        <h2 className="text-h3 font-bold">
          {staff.length === 0 ? 'Nobody on the staff list yet' : 'The team'}
        </h2>

        {staff.length === 0 ? (
          <div className="mt-6 max-w-2xl border-l-4 border-support bg-paper-sunk p-8">
            <p className="text-lead">No staff records yet.</p>
            <p className="mt-4 text-ink-soft">
              Ask each employee to create an account, then search for them
              above. Everyone gets their own staff number, from MM-STF-0001
              onwards, and it stays theirs for good.
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[60rem] border-collapse">
              <thead>
                <tr className="border-b border-ink text-left">
                  {[
                    'Staff no.',
                    'Name',
                    'Contact',
                    'Job',
                    'Can do',
                    'Status',
                    'Since',
                    'Change',
                  ].map((h) => (
                    <th
                      key={h}
                      className="py-3 pr-6 font-mono text-micro uppercase tracking-label text-ink-faint"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((person) => {
                  const isMe = person.userId === me.id
                  return (
                    <tr
                      key={person.userId}
                      className="border-b border-rule align-top"
                    >
                      <td className="py-4 pr-6 font-mono text-small tabular-nums">
                        {person.staffNumber}
                      </td>
                      <td className="py-4 pr-6">
                        <span className="font-bold">
                          {person.fullName ?? '—'}
                        </span>
                        {isMe && (
                          <span className="ml-2 font-mono text-micro uppercase tracking-label text-support">
                            you
                          </span>
                        )}
                      </td>
                      <td className="py-4 pr-6 text-small text-ink-soft">
                        {person.email ?? '—'}
                        {person.phone && (
                          <span className="mt-1 block font-mono text-micro text-ink-faint">
                            {person.phone}
                          </span>
                        )}
                      </td>
                      <td className="py-4 pr-6 text-small text-ink-soft">
                        {person.jobTitle ?? '—'}
                      </td>
                      <td className="py-4 pr-6 text-small">
                        {person.roles.filter((r) => r !== 'CUSTOMER').join(', ') ||
                          <span className="text-ink-faint">nothing</span>}
                      </td>
                      <td
                        className={`py-4 pr-6 font-mono text-micro uppercase tracking-label ${
                          person.status === 'ACTIVE'
                            ? 'text-support'
                            : 'text-accent'
                        }`}
                      >
                        {person.status ? STATUS_LABEL[person.status] : '—'}
                      </td>
                      <td className="py-4 pr-6 font-mono text-small tabular-nums text-ink-faint">
                        {person.joinedAt
                          ? new Date(person.joinedAt).toLocaleDateString(
                              'en-GB',
                              { day: '2-digit', month: 'short', year: 'numeric' },
                            )
                          : '—'}
                      </td>
                      <td className="py-4">
                        <StaffRowActions
                          userId={person.userId}
                          name={person.fullName ?? person.email ?? 'this person'}
                          status={person.status}
                          roles={person.roles}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <p className="mt-6 max-w-measure text-small text-ink-faint">
              Marking someone as suspended or left also takes away their access
              straight away, but keeps their record — so last month&rsquo;s
              orders still show who packed them. Staff numbers are never reused.
              The system will not let you remove the last admin.
            </p>
          </div>
        )}
      </section>
    </main>
  )
}
