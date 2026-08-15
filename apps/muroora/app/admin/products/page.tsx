import type { Metadata } from 'next'

import { requireRole } from '@/lib/auth'
import { format } from '@/lib/money'
import {
  countLowStock,
  listAdminProducts,
  listCategories,
} from '@/lib/services/products'
import { AddProductForm } from '@/app/admin/products/AddProductForm'
import { StockAdjuster } from '@/app/admin/products/StockAdjuster'

export const metadata: Metadata = {
  title: 'Products',
  robots: { index: false, follow: false },
}

/** Never cache an admin screen — stock changes while you are looking at it. */
export const dynamic = 'force-dynamic'

export default async function AdminProductsPage() {
  // The real gate. See the note in actions.ts about why middleware is not it.
  await requireRole('ADMIN', 'SUPER_ADMIN')

  // Read through the service, not the database. This page holds no queries and
  // no business rules — see TASKS.md and section 56 of the brief.
  const [categoryRows, rows, lowCount] = await Promise.all([
    listCategories(),
    listAdminProducts(),
    countLowStock(),
  ])

  return (
    <main className="mx-auto max-w-[86rem] px-gutter py-12">
      <header className="border-b border-rule pb-8">
        <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
          Admin
        </p>
        <h1 className="mt-3 text-h1">Products</h1>
        <p className="mt-4 max-w-measure text-ink-soft">
          Everything the shop sells. Adding a product here puts it in the
          customer shop; hiding one takes it out without deleting its history.
        </p>

        <dl className="mt-8 flex flex-wrap gap-x-12 gap-y-4">
          <div>
            <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
              Products
            </dt>
            <dd className="mt-1 text-h3 font-bold">{rows.length}</dd>
          </div>
          <div>
            <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
              In the shop
            </dt>
            <dd className="mt-1 text-h3 font-bold">
              {rows.filter((r) => r.isActive).length}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
              Low or out of stock
            </dt>
            <dd
              className={`mt-1 text-h3 font-bold ${lowCount > 0 ? 'text-accent' : ''}`}
            >
              {lowCount}
            </dd>
          </div>
        </dl>
      </header>

      <section className="border-b border-rule py-10">
        <h2 className="text-h3 font-bold">Add a product</h2>
        <AddProductForm categories={categoryRows} />
      </section>

      <section className="py-10">
        <h2 className="text-h3 font-bold">
          {rows.length === 0 ? 'Nothing here yet' : 'Everything you sell'}
        </h2>

        {rows.length === 0 ? (
          /* An empty catalogue that says so, rather than demo products. This
             is a real shop — invented stock would be indistinguishable from
             real stock once it was in, and somebody would try to order it. */
          <div className="mt-6 max-w-2xl border-l-4 border-support bg-paper-sunk p-8">
            <p className="text-lead">
              No products yet. Nothing was invented to fill this page.
            </p>
            <p className="mt-4 text-ink-soft">
              Add your real stock above — name, size, price and how many you
              have. Each one appears in the customer shop straight away, and its
              stock level is tracked from the moment you enter it.
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[56rem] border-collapse">
              <thead>
                <tr className="border-b border-ink text-left">
                  {[
                    'Product',
                    'Category',
                    'Price',
                    'Cost',
                    'In stock',
                    'Held',
                    'Adjust stock',
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
                {rows.map((row) => {
                  const stock = row.quantity
                  const low = stock <= row.lowStockThreshold
                  return (
                    <tr key={row.id} className="border-b border-rule align-top">
                      <td className="py-4 pr-6">
                        <span className="font-bold">{row.name}</span>
                        {row.unitSize && (
                          <span className="text-ink-faint"> · {row.unitSize}</span>
                        )}
                        <span className="mt-1 block font-mono text-micro text-ink-faint">
                          {row.sku}
                          {!row.isActive && ' · HIDDEN'}
                        </span>
                      </td>
                      <td className="py-4 pr-6 text-small text-ink-soft">
                        {row.categoryName ?? '—'}
                      </td>
                      <td className="py-4 pr-6 font-mono text-small tabular-nums">
                        {format(row.price)}
                      </td>
                      {/* Cost price is on an admin-only screen behind
                          requireRole. It must never appear in a customer
                          query — see the note on the column in the schema. */}
                      <td className="py-4 pr-6 font-mono text-small tabular-nums text-ink-faint">
                        {row.costPrice ? format(row.costPrice) : '—'}
                      </td>
                      <td
                        className={`py-4 pr-6 font-mono text-small tabular-nums ${low ? 'font-bold text-accent' : ''}`}
                      >
                        {stock}
                        {low && ' ⚠'}
                      </td>
                      <td className="py-4 pr-6 font-mono text-small tabular-nums text-ink-faint">
                        {row.reserved}
                      </td>
                      <td className="py-4">
                        <StockAdjuster
                          productId={row.id}
                          productName={row.name}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <p className="mt-6 max-w-measure text-small text-ink-faint">
              &ldquo;Held&rdquo; is stock committed to orders that have not been
              packed yet. It is still on the shelf but cannot be sold twice.
              Every stock change is recorded with who made it and why.
            </p>
          </div>
        )}
      </section>
    </main>
  )
}
