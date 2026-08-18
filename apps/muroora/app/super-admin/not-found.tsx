import Link from 'next/link'

/**
 * Any Control Center address that does not exist.
 *
 * A bare 404 inside an administration area is genuinely alarming: the person
 * seeing it cannot tell whether they typed something wrong, whether their
 * access was removed, or whether the platform is broken. This says which, and
 * gives them a way back.
 */
export default function ControlCenterNotFound() {
  return (
    <>
      <header className="cc-head">
        <p className="cc-eyebrow">Not here</p>
        <h1 className="cc-title">There is no such page</h1>
        <p className="cc-sub">
          Nothing is broken and your access is fine - this address simply does
          not exist. Some parts of the Control Center are still being built.
        </p>
      </header>

      <section className="cc-panel">
        <div className="cc-panel-body">
          <p style={{ marginTop: 0 }}>Everything that does exist:</p>
          <ul style={{ paddingLeft: '1.15rem' }}>
            <li><Link href="/super-admin">Overview</Link></li>
            <li><Link href="/super-admin/applications">Applications</Link></li>
            <li><Link href="/super-admin/businesses">Businesses</Link></li>
            <li><Link href="/super-admin/orders">Orders</Link></li>
            <li><Link href="/super-admin/reports">Reports and safety</Link></li>
            <li><Link href="/super-admin/releases">Mobile app</Link></li>
            <li><Link href="/super-admin/audit">Audit log</Link></li>
          </ul>
        </div>
      </section>
    </>
  )
}
