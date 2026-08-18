import Link from 'next/link'

import { listAllBusinesses } from '@/lib/platform/applications'
import { requirePermission } from '@/lib/platform/auth'
import { StatusChip, humanise } from '@/app/super-admin/StatusChip'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Businesses' }

/** Every business on the platform, whatever its state. */
export default async function BusinessesPage() {
  await requirePermission('businesses.view')
  const rows = await listAllBusinesses()

  const live = rows.filter((r) => r.status === 'ACTIVE' || r.status === 'PILOT')

  return (
    <>
      <header className="cc-head">
        <p className="cc-eyebrow">Directory</p>
        <h1 className="cc-title">Every business on Musuwo</h1>
        <p className="cc-sub">
          {rows.length === 0
            ? 'None yet.'
            : `${rows.length} in total, ${live.length} visible to the public.`}
        </p>
      </header>

      <section className="cc-panel">
        {rows.length === 0 ? (
          <div className="cc-empty">
            <p>
              <strong>No businesses yet.</strong>
              One appears here the moment an application is approved.
            </p>
          </div>
        ) : (
          <div className="cc-scroll">
            <table className="cc-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>City</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id}>
                    <td className="cc-mono">{b.publicId}</td>
                    <td>
                      <strong>{b.name}</strong>
                      {b.isFounding && (
                        <>
                          {' '}
                          <span className="cc-chip cc-chip-ok">Founding</span>
                        </>
                      )}
                    </td>
                    <td>{humanise(b.kind)}</td>
                    <td>{b.city}</td>
                    <td><StatusChip status={b.status} /></td>
                    <td className="cc-mono">
                      {b.createdAt.toISOString().slice(0, 10)}
                    </td>
                    <td>
                      <Link href={`/stores/${b.slug}`}>Storefront</Link>
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
