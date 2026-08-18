import { listPlatformAudit } from '@/lib/platform/admins'
import { requirePlatformAdmin } from '@/lib/platform/auth'
import { humanise } from '@/app/super-admin/StatusChip'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Audit log' }

/**
 * Everything privileged that has happened.
 *
 * Visible to every administrator, not only the owner, and that is deliberate:
 * a log that only the person with the most power can read is not much of a
 * check on power. What nobody can do - owner included - is change it. The
 * table refuses UPDATE and DELETE at the database level.
 */
export default async function AuditPage() {
  await requirePlatformAdmin()
  const events = await listPlatformAudit(200)

  return (
    <>
      <header className="cc-head">
        <p className="cc-eyebrow">Audit log</p>
        <h1 className="cc-title">What has been done, and by whom</h1>
        <p className="cc-sub">
          Approvals, rejections, permission changes and administrator changes.
          Nobody can edit or delete an entry, including the Platform Owner — the
          database refuses both.
        </p>
      </header>

      <section className="cc-panel">
        {events.length === 0 ? (
          <div className="cc-empty">
            <p>
              <strong>Nothing yet.</strong>
              The first entry appears the moment somebody approves an
              application or changes an administrator.
            </p>
          </div>
        ) : (
          <div className="cc-scroll">
            <table className="cc-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>Action</th>
                  <th>On</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td className="cc-mono">
                      {e.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                    </td>
                    <td>
                      <strong>{e.actorName ?? 'System'}</strong>
                      <br />
                      <span className="cc-mono">{e.actorRole ?? ''}</span>
                    </td>
                    <td>{humanise(e.action)}</td>
                    <td>{e.entityType.replace(/_/g, ' ')}</td>
                    <td>
                      {e.reason ? <>{e.reason}<br /></> : null}
                      {e.changes ? (
                        <span className="cc-mono">
                          {JSON.stringify(e.changes).slice(0, 120)}
                        </span>
                      ) : null}
                    </td>
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
