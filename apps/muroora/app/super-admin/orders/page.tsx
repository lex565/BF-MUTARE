import { listPlatformOrders } from '@/lib/platform/applications'
import { requirePermission } from '@/lib/platform/auth'
import { StatusChip } from '@/app/super-admin/StatusChip'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Orders' }

/**
 * Every order on the platform, whichever merchant took it.
 *
 * A customer shopping on muroora-mart.vercel.app buys from Muroora Mart - that
 * is the name they see, on the site, the receipt and the delivery message.
 * The order lands here all the same, because Musuwo is what carries it to
 * them. The merchant packs; Musuwo delivers.
 *
 * Unlike the staff order screen, this is not scoped to one store.
 */
export default async function PlatformOrdersPage() {
  await requirePermission('orders.view')
  const rows = await listPlatformOrders(200)

  const money = (amount: bigint, currency: string) =>
    `${currency === 'USD' ? '$' : currency + ' '}${(Number(amount) / 100).toFixed(2)}`

  return (
    <>
      <header className="cc-head">
        <p className="cc-eyebrow">Orders</p>
        <h1 className="cc-title">Everything customers have bought</h1>
        <p className="cc-sub">
          Across every merchant. The customer sees the shop&rsquo;s name;
          Musuwo coordinates the delivery.
        </p>
      </header>

      <section className="cc-panel">
        {rows.length === 0 ? (
          <div className="cc-empty">
            <p>
              <strong>No orders yet.</strong>
              An order appears here the moment somebody checks out on any
              business&rsquo;s site, including Muroora Mart&rsquo;s own.
            </p>
          </div>
        ) : (
          <div className="cc-scroll">
            <table className="cc-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Merchant</th>
                  <th>To</th>
                  <th>Area</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Placed</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td className="cc-mono"><strong>{o.orderNumber}</strong></td>
                    <td>
                      {o.merchantName ?? 'Unlinked store'}
                      {o.merchantPublicId && (
                        <>
                          <br />
                          <span className="cc-mono">{o.merchantPublicId}</span>
                        </>
                      )}
                    </td>
                    <td>{o.recipientName}</td>
                    <td>{o.deliverySuburb}</td>
                    <td><StatusChip status={o.status} /></td>
                    <td className="cc-mono">{money(o.totalAmount, o.currency)}</td>
                    <td className="cc-mono">
                      {o.placedAt ? o.placedAt.toISOString().slice(0, 16).replace('T', ' ') : '—'}
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
