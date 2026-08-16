import type { Metadata } from 'next'

import { requireRole } from '@/lib/auth'
import { format } from '@/lib/money'
import { listHandoverQueue } from '@/lib/services/riders'
import { HandoverControls } from './HandoverControls'

export const metadata: Metadata = { title: 'Rider handovers', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function HandoverPage() {
  await requireRole('SHOP_STAFF', 'ADMIN', 'SUPER_ADMIN', 'VIEWER')
  const rows = await listHandoverQueue()
  return <main className="mx-auto max-w-[72rem] px-gutter py-12"><header className="border-b border-rule pb-8"><p className="font-mono text-micro uppercase tracking-label text-ink-faint">Staff · Dispatch</p><h1 className="mt-3 text-h1">Rider handovers</h1><p className="mt-4 max-w-measure text-ink-soft">Check the package, start handover, then let the named rider confirm collection. Goods remain in shop custody until that second confirmation.</p></header><section className="py-10">{rows.length === 0 ? <div className="border-l-4 border-support bg-paper-sunk p-6"><p className="font-bold">No rider is waiting for a handover.</p></div> : <div className="space-y-5">{rows.map(row => <article key={row.deliveryId} className="grid gap-6 border border-rule p-6 md:grid-cols-[1fr_1fr]"><div><p className="font-mono text-small font-bold">{row.orderNumber}</p><p className="mt-2 text-lead">{row.publicRiderId} · {row.riderName}</p><p className="mt-1 text-small text-ink-soft">{row.vehicleType ?? 'Vehicle not recorded'} · {row.deliverySuburb}</p><p className="mt-3 font-mono text-small">Goods: {format({ amount: row.merchandiseValueAmount, currency: row.currency })}</p><p className="mt-2 font-mono text-micro uppercase tracking-label text-ink-faint">{row.status} · {row.custodyState}</p></div><HandoverControls deliveryId={row.deliveryId} started={row.custodyState === 'HANDOVER_STARTED'} /></article>)}</div>}</section></main>
}
