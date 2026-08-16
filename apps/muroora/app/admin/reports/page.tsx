import type { Metadata } from 'next'
import Link from 'next/link'

import { requireAdminView } from '@/lib/auth'
import { format } from '@/lib/money'
import { getReports } from '@/lib/services/reports'
import {
  SalesChart,
  StockBands,
  TopProductsChart,
} from '@/app/admin/reports/Charts'

export const metadata: Metadata = {
  title: 'Reports',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

const WINDOWS = [7, 30, 90] as const

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  await requireAdminView()

  const { days: raw } = await searchParams
  const days = WINDOWS.includes(Number(raw) as never) ? Number(raw) : 30
  const r = await getReports(days)

  return (
    <main className="mx-auto max-w-[86rem] px-gutter py-12">
      <header className="border-b border-rule pb-8">
        <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
          Admin
        </p>
        <h1 className="mt-3 text-h1">Reports</h1>
        <p className="mt-4 max-w-measure text-ink-soft">
          What the shop has actually done. Everything here is counted from real
          orders and real stock movements. Nothing is estimated.
        </p>

        <nav aria-label="Time range" className="mt-6 flex flex-wrap gap-2">
          {WINDOWS.map((w) => (
            <Link
              key={w}
              href={`/admin/reports?days=${w}`}
              aria-current={w === days ? 'true' : undefined}
              className={`border px-4 py-2 font-mono text-micro uppercase tracking-label transition-colors ${
                w === days
                  ? 'border-ink bg-ink text-paper'
                  : 'border-rule hover:border-ink'
              }`}
            >
              Last {w} days
            </Link>
          ))}
        </nav>
      </header>

      {!r.hasOrders ? (
        <section className="py-10">
          <div className="max-w-2xl border-l-4 border-support bg-paper-sunk p-8">
            <p className="text-lead">No orders yet, so there is nothing to chart.</p>
            <p className="mt-4 text-ink-soft">
              Charts of zero would look like a quiet month rather than a shop
              that has not opened. As soon as the first order is placed, this
              page fills in by itself.
            </p>
            <p className="mt-4 text-ink-soft">
              Two things are needed before a customer can order: at least one
              delivery area switched on, and products with stock.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/admin/delivery"
                className="border border-ink px-4 py-2 font-mono text-micro uppercase tracking-label transition-colors hover:bg-ink hover:text-paper"
              >
                Delivery areas
              </Link>
              <Link
                href="/admin/products"
                className="border border-ink px-4 py-2 font-mono text-micro uppercase tracking-label transition-colors hover:bg-ink hover:text-paper"
              >
                Products
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="border-b border-rule py-10">
            <h2 className="text-h3 font-bold">Money taken</h2>
            <dl className="mt-6 flex flex-wrap gap-x-12 gap-y-4">
              <div>
                <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                  Total
                </dt>
                <dd className="mt-1 text-h2 font-bold tabular-nums">
                  {format(r.totals.revenue)}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                  Orders
                </dt>
                <dd className="mt-1 text-h2 font-bold tabular-nums">
                  {r.totals.orders}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                  Average order
                </dt>
                <dd className="mt-1 text-h2 font-bold tabular-nums">
                  {r.totals.averageOrder ? format(r.totals.averageOrder) : '-'}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                  Delivered
                </dt>
                <dd className="mt-1 text-h2 font-bold tabular-nums">
                  {r.totals.delivered}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                  Cancelled
                </dt>
                <dd
                  className={`mt-1 text-h2 font-bold tabular-nums ${r.totals.cancelled > 0 ? 'text-accent' : ''}`}
                >
                  {r.totals.cancelled}
                </dd>
              </div>
            </dl>

            <SalesChart points={r.daily} />
          </section>

          <section className="border-b border-rule py-10">
            <h2 className="text-h3 font-bold">What sells</h2>
            {r.topProducts.length === 0 ? (
              <p className="mt-4 text-ink-soft">Nothing sold in this period.</p>
            ) : (
              <>
                <p className="mt-3 max-w-measure text-ink-soft">
                  Ordered by how many units left the shelf, not by money, so a
                  cheap staple that moves constantly is not hidden behind one
                  expensive sale.
                </p>
                <TopProductsChart rows={r.topProducts} />
              </>
            )}
          </section>
        </>
      )}

      <section className="border-b border-rule py-10">
        <h2 className="text-h3 font-bold">Stock health</h2>
        <StockBands bands={r.stockBands} />
      </section>

      <section className="py-10">
        <h2 className="text-h3 font-bold">Stock movements</h2>
        {r.stockMoves.length === 0 ? (
          <p className="mt-4 text-ink-soft">
            No stock has moved in the last {days} days.
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse">
              <thead>
                <tr className="border-b border-ink text-left">
                  {['What happened', 'Times', 'Net change'].map((h) => (
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
                {r.stockMoves.map((m) => (
                  <tr key={m.type} className="border-b border-rule">
                    <td className="py-3 pr-6 text-small">
                      {m.type.toLowerCase().replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 pr-6 font-mono text-small tabular-nums">
                      {m.count}
                    </td>
                    <td
                      className={`py-3 pr-6 font-mono text-small tabular-nums ${m.net < 0 ? 'text-accent' : ''}`}
                    >
                      {m.net > 0 ? `+${m.net}` : m.net}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 max-w-measure text-small text-ink-faint">
              Net change is how many units this added to or took off the shelf
              in total. Reservations show as zero because holding stock for an
              order does not move it yet.
            </p>
          </div>
        )}
      </section>
    </main>
  )
}
