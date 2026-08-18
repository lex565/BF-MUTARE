import { requirePlatformAdmin } from '@/lib/platform/auth'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Reports and safety' }

/**
 * Reports and safety.
 *
 * THIS PAGE EXISTS SO THAT THE URL DOES NOT 404, and it says plainly that
 * nothing is being collected yet rather than showing an empty table that
 * implies it is. An empty table is a promise; a sentence is the truth.
 *
 * Case management - reports against a business, a customer, a listing or a
 * delivery, with statuses and outcomes - is §39-43 of the provider brief and is
 * not built. When it is, it replaces this file. Until then a reviewer who lands
 * here should leave knowing there is nothing to miss, not wondering whether the
 * page is broken.
 */
export default async function ReportsPage() {
  await requirePlatformAdmin()

  return (
    <>
      <header className="cc-head">
        <p className="cc-eyebrow">Reports and safety</p>
        <h1 className="cc-title">Nothing to report yet</h1>
        <p className="cc-sub">
          Nobody has reported a business, a listing or a delivery. When somebody
          does, it appears here.
        </p>
      </header>

      <section className="cc-panel">
        <div className="cc-empty">
          <p>
            <strong>No cases are open.</strong>
            Reporting is not switched on for customers yet, so this will stay
            empty until it is. If somebody raises something with you directly in
            the meantime, put it in the business&rsquo;s notes so there is a
            record of it.
          </p>
        </div>
      </section>

      <section className="cc-panel">
        <div className="cc-panel-head">
          <h2>What will land here</h2>
        </div>
        <div className="cc-panel-body">
          <ul style={{ margin: 0, paddingLeft: '1.15rem', color: 'var(--cc-ink-soft)' }}>
            <li style={{ marginBottom: '.45rem' }}>
              A customer reporting a business, a listing or an order
            </li>
            <li style={{ marginBottom: '.45rem' }}>
              A business reporting a customer
            </li>
            <li style={{ marginBottom: '.45rem' }}>
              Anything raised about a delivery or a handover
            </li>
            <li>
              Safety concerns about accommodation, which are handled separately
              and with more care
            </li>
          </ul>
          <p style={{ marginBottom: 0, marginTop: '1.1rem', color: 'var(--cc-ink-faint)', fontSize: '.9rem' }}>
            Security reports about the app itself are separate and already
            working - they arrive on the Mobile app screen, and are hidden from
            administrators without the security permission.
          </p>
        </div>
      </section>
    </>
  )
}
