import Link from 'next/link'

import { listAllBusinesses } from '@/lib/platform/applications'
import { can, requirePermission } from '@/lib/platform/auth'
import { StatusChip, humanise } from '@/app/super-admin/StatusChip'
import { VerifyPanel } from '@/app/super-admin/businesses/VerifyPanel'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Businesses' }

/** Every business on the platform, whatever its state. */
export default async function BusinessesPage() {
  const admin = await requirePermission('businesses.view')
  const rows = await listAllBusinesses()

  const live = rows.filter((r) => r.status === 'ACTIVE' || r.status === 'PILOT')
  const mayVerify = can(admin, 'businesses.verify')

  return (
    <>
      <header className="cc-head">
        <p className="cc-eyebrow">Directory</p>
        <h1 className="cc-title">Every business on Musuwo</h1>
        <p className="cc-sub">
          {rows.length === 0
            ? 'None yet.'
            : `${rows.length} in total, ${live.length} visible to the public, ${rows.filter((r) => r.verifiedAt).length} with a licence on file.`}
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
                  <th>Licence</th>
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
                    <td>
                      {b.verifiedAt ? (
                        <>
                          <span className="cc-chip cc-chip-ok">Verified</span>
                          <br />
                          <span className="cc-mono">{b.licenceNumber}</span>
                        </>
                      ) : (
                        <span className="cc-mono">Not checked</span>
                      )}
                      {mayVerify && (
                        <div style={{ marginTop: '.5rem' }}>
                          <VerifyPanel
                            businessId={b.id}
                            name={b.name}
                            licenceNumber={b.licenceNumber}
                            verified={b.verifiedAt !== null}
                          />
                        </div>
                      )}
                    </td>
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
