import Link from 'next/link'
import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { businessApplications, businesses } from '@/db/schema/marketplace'
import { orders } from '@/db/schema/orders'
import { users } from '@/db/schema/identity'
import { platformAuditLog, platformRoles } from '@/db/schema/platform'
import { requirePlatformAdmin } from '@/lib/platform/auth'
import { StatusChip, humanise } from '@/app/super-admin/StatusChip'

export const dynamic = 'force-dynamic'

/**
 * The overview.
 *
 * EVERY NUMBER ON THIS PAGE IS A REAL QUERY. §15 says do not fabricate metrics
 * and show honest zeroes instead, and that matters more than it sounds: a
 * dashboard showing invented figures is worse than no dashboard, because
 * somebody will eventually make a decision on one.
 *
 * So there are no sparklines of nothing, no "+12% this week" against a week
 * that was never measured, and no revenue. Where the answer is zero it says
 * zero and, where it helps, says why.
 */

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>
}) {
  const admin = await requirePlatformAdmin()
  const { denied } = await searchParams

  const today = startOfToday()

  const [
    [pending],
    [liveBusinesses],
    [allBusinesses],
    [ordersToday],
    [customers],
    [activeAdmins],
    recentApplications,
    recentActivity,
  ] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(businessApplications)
      .where(
        inArray(businessApplications.status, [
          'SUBMITTED',
          'UNDER_REVIEW',
          'NEEDS_INFORMATION',
        ]),
      ),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(businesses)
      .where(
        and(inArray(businesses.status, ['ACTIVE', 'PILOT']), isNull(businesses.deletedAt)),
      ),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(businesses)
      .where(isNull(businesses.deletedAt)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(gte(orders.createdAt, today)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .where(isNull(users.deletedAt)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(platformRoles)
      .where(
        and(eq(platformRoles.role, 'SUPER_ADMIN'), eq(platformRoles.status, 'ACTIVE')),
      ),
    db
      .select({
        id: businessApplications.id,
        businessName: businessApplications.businessName,
        kind: businessApplications.kind,
        status: businessApplications.status,
        submittedAt: businessApplications.submittedAt,
      })
      .from(businessApplications)
      .orderBy(desc(businessApplications.submittedAt))
      .limit(6),
    db
      .select({
        id: platformAuditLog.id,
        action: platformAuditLog.action,
        entityType: platformAuditLog.entityType,
        createdAt: platformAuditLog.createdAt,
        actorName: users.fullName,
      })
      .from(platformAuditLog)
      .leftJoin(users, eq(users.id, platformAuditLog.actorId))
      .orderBy(desc(platformAuditLog.createdAt))
      .limit(8),
  ])

  return (
    <>
      <header className="cc-head">
        <p className="cc-eyebrow">Overview</p>
        <h1 className="cc-title">
          {admin.isOwner ? 'Musuwo, top to bottom' : 'Musuwo operations'}
        </h1>
        <p className="cc-sub">
          Everything below is counted from the database at the moment this page
          loaded. Where it says zero, it is zero.
        </p>
      </header>

      {denied && (
        <p className="cc-note cc-error" role="alert">
          Your account does not have permission for that. If you need it, the
          Platform Owner can grant it.
        </p>
      )}

      <div className="cc-tiles">
        <div className={pending.n > 0 ? 'cc-tile cc-tile-attention' : 'cc-tile'}>
          <p className="cc-tile-label">Waiting for review</p>
          <p className="cc-tile-value">{pending.n}</p>
          <p className="cc-tile-note">
            {pending.n === 0
              ? 'Nothing waiting on a person.'
              : pending.n === 1
                ? 'One business is waiting on you.'
                : `${pending.n} businesses are waiting on you.`}
          </p>
        </div>

        <div className="cc-tile">
          <p className="cc-tile-label">Live businesses</p>
          <p className="cc-tile-value">{liveBusinesses.n}</p>
          <p className="cc-tile-note">
            {allBusinesses.n === liveBusinesses.n
              ? 'All of them public.'
              : `${allBusinesses.n} in total, the rest not public.`}
          </p>
        </div>

        <div className="cc-tile">
          <p className="cc-tile-label">Orders today</p>
          <p className="cc-tile-value">{ordersToday.n}</p>
          <p className="cc-tile-note">Since midnight, across every merchant.</p>
        </div>

        <div className="cc-tile">
          <p className="cc-tile-label">Registered people</p>
          <p className="cc-tile-value">{customers.n}</p>
          <p className="cc-tile-note">Customers, staff and riders together.</p>
        </div>

        <div className="cc-tile">
          <p className="cc-tile-label">Super Admins</p>
          <p className="cc-tile-value">{activeAdmins.n}</p>
          <p className="cc-tile-note">Active, of ten allowed.</p>
        </div>
      </div>

      <section className="cc-panel">
        <div className="cc-panel-head">
          <h2>Latest applications</h2>
          <Link href="/super-admin/applications" className="cc-mono">
            See all →
          </Link>
        </div>
        {recentApplications.length === 0 ? (
          <div className="cc-empty">
            <p>
              <strong>No business has applied yet.</strong>
              When somebody applies through the website or the app, they appear
              here and in the queue.
            </p>
          </div>
        ) : (
          <div className="cc-scroll">
            <table className="cc-table">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recentApplications.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.businessName}</strong></td>
                    <td>{humanise(a.kind)}</td>
                    <td><StatusChip status={a.status} /></td>
                    <td className="cc-mono">
                      {a.submittedAt
                        ? a.submittedAt.toISOString().slice(0, 10)
                        : '—'}
                    </td>
                    <td>
                      <Link href={`/super-admin/applications/${a.id}`}>Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="cc-panel">
        <div className="cc-panel-head">
          <h2>Recent administrative activity</h2>
          <Link href="/super-admin/audit" className="cc-mono">
            Full log →
          </Link>
        </div>
        {recentActivity.length === 0 ? (
          <div className="cc-empty">
            <p>
              <strong>Nothing recorded yet.</strong>
              Every approval, rejection and permission change is logged here and
              cannot be edited or deleted afterwards.
            </p>
          </div>
        ) : (
          <ul className="cc-timeline cc-panel-body">
            {recentActivity.map((e) => (
              <li key={e.id}>
                <time dateTime={e.createdAt.toISOString()}>
                  {e.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                </time>
                <div>
                  <strong>{humanise(e.action)}</strong>
                  <p>
                    {e.actorName ?? 'System'} · {e.entityType.replace(/_/g, ' ')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Honest about what is not measured yet, rather than showing an empty
          chart that implies it is. */}
      <section className="cc-panel">
        <div className="cc-panel-head">
          <h2>Search and ranking</h2>
        </div>
        <div className="cc-empty">
          <p>
            <strong>Not being collected yet.</strong>
            Search demand, zero-result queries and ranking signals need a search
            event log that does not exist. Building the dashboard before the
            data would mean inventing the numbers, so this stays empty until
            collection is switched on.
          </p>
        </div>
      </section>
    </>
  )
}
