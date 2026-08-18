import Link from 'next/link'

import { listApplications } from '@/lib/platform/applications'
import { requirePermission } from '@/lib/platform/auth'
import { StatusChip, humanise } from '@/app/super-admin/StatusChip'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Applications' }

const FILTERS = [
  ['open', 'Open'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
  ['all', 'Everything'],
] as const

type Filter = (typeof FILTERS)[number][0]

/**
 * The review queue.
 *
 * Oldest first. A newest-first queue lets the awkward application nobody wants
 * to pick up sink out of sight, and for the person who submitted it that is
 * indistinguishable from being ignored.
 */
export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  await requirePermission('business_applications.review')
  const { filter } = await searchParams
  const active: Filter = (FILTERS.map((f) => f[0]) as string[]).includes(
    filter ?? '',
  )
    ? (filter as Filter)
    : 'open'

  const rows = await listApplications(active)

  return (
    <>
      <header className="cc-head">
        <p className="cc-eyebrow">Business applications</p>
        <h1 className="cc-title">Who wants to join Musuwo</h1>
        <p className="cc-sub">
          Oldest first, on purpose. Approving one creates a live business and
          makes the applicant its owner.
        </p>
      </header>

      <div className="cc-actions" style={{ marginTop: 0, marginBottom: '1.5rem' }}>
        {FILTERS.map(([value, label]) => (
          <Link
            key={value}
            href={`/super-admin/applications?filter=${value}`}
            className={
              value === active ? 'cc-btn cc-btn-go' : 'cc-btn cc-btn-quiet'
            }
          >
            {label}
          </Link>
        ))}
      </div>

      <section className="cc-panel">
        {rows.length === 0 ? (
          <div className="cc-empty">
            <p>
              <strong>Nothing here.</strong>
              {active === 'open'
                ? ' No application is waiting on a decision.'
                : ' No application matches that filter.'}
            </p>
          </div>
        ) : (
          <div className="cc-scroll">
            <table className="cc-table">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Type</th>
                  <th>City</th>
                  <th>Applicant</th>
                  <th>Status</th>
                  <th>Reviewer</th>
                  <th>Submitted</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.businessName}</strong></td>
                    <td>{humanise(r.kind)}</td>
                    <td>{r.city}</td>
                    <td>
                      {r.applicantName ?? '—'}
                      <br />
                      <span className="cc-mono">{r.applicantEmail ?? ''}</span>
                    </td>
                    <td><StatusChip status={r.status} /></td>
                    <td>{r.assignedToName ?? <span className="cc-mono">Unassigned</span>}</td>
                    <td className="cc-mono">
                      {r.submittedAt ? r.submittedAt.toISOString().slice(0, 10) : '—'}
                    </td>
                    <td><Link href={`/super-admin/applications/${r.id}`}>Review</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
