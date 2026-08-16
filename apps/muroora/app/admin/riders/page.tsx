import type { Metadata } from 'next'
import Link from 'next/link'

import { requireAdminView } from '@/lib/auth'
import { format } from '@/lib/money'
import {
  listAvailableRiders,
  listDispatchQueue,
  listRidersForAdmin,
  listTrustLevels,
} from '@/lib/services/riders'
import { AssignDeliveryForm, CreateDeliveryForm, TrustLevelForm } from './RiderForms'

export const metadata: Metadata = { title: 'Riders', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function AdminRidersPage() {
  await requireAdminView()
  const [riders, levels, queue, available] = await Promise.all([
    listRidersForAdmin(), listTrustLevels(), listDispatchQueue(), listAvailableRiders(),
  ])
  return <main className="mx-auto max-w-[86rem] px-gutter py-12">
    <header className="border-b border-rule pb-8">
      <p className="font-mono text-micro uppercase tracking-label text-ink-faint">Admin</p>
      <h1 className="mt-3 text-h1">Riders and dispatch</h1>
      <p className="mt-4 max-w-measure text-ink-soft">Approve riders deliberately, control the value of goods in their custody, and keep every handover or exception traceable.</p>
      <dl className="mt-8 flex flex-wrap gap-10"><div><dt className="font-mono text-micro uppercase tracking-label text-ink-faint">Applications</dt><dd className="mt-1 text-h3 font-bold">{riders.filter(r => r.accountStatus === 'APPLICATION' || r.accountStatus === 'UNDER_REVIEW').length}</dd></div><div><dt className="font-mono text-micro uppercase tracking-label text-ink-faint">Available now</dt><dd className="mt-1 text-h3 font-bold">{available.length}</dd></div><div><dt className="font-mono text-micro uppercase tracking-label text-ink-faint">Dispatch queue</dt><dd className="mt-1 text-h3 font-bold">{queue.length}</dd></div></dl>
    </header>

    <section className="border-b border-rule py-10"><h2 className="text-h3 font-bold">Trust levels</h2><p className="mt-3 max-w-measure text-ink-soft">Limits are configured by management. Delivery count never promotes a rider automatically.</p><TrustLevelForm />{levels.length > 0 && <div className="mt-5 flex flex-wrap gap-3">{levels.map(l => <span key={l.id} className="border border-rule px-3 py-2 text-small">Level {l.level}: {l.name} · {l.maxExposureAmount == null ? 'no limit set' : format({ amount: l.maxExposureAmount, currency: l.currency })}</span>)}</div>}</section>

    <section className="border-b border-rule py-10"><h2 className="text-h3 font-bold">Ready and active deliveries</h2>{queue.length === 0 ? <p className="mt-4 text-ink-soft">No orders are waiting for dispatch.</p> : <div className="mt-6 space-y-4">{queue.map(item => <article key={item.orderId} className="grid gap-5 border border-rule p-5 lg:grid-cols-[1fr_2fr]"><div><p className="font-mono text-small font-bold">{item.orderNumber}</p><p className="mt-1 text-small text-ink-soft">{item.deliverySuburb} · {format({ amount: item.merchandiseValueAmount, currency: item.currency })}</p><p className="mt-2 font-mono text-micro uppercase tracking-label text-ink-faint">{item.deliveryStatus ?? item.orderStatus} · {item.custodyState ?? 'SHOP_CUSTODY'}</p></div><div>{!item.deliveryId ? <CreateDeliveryForm orderId={item.orderId} currency={item.currency} /> : item.deliveryStatus === 'CREATED' ? <AssignDeliveryForm deliveryId={item.deliveryId} riders={available} /> : item.riderId ? <Link href={`/admin/riders/${item.riderId}`} className="font-mono text-micro uppercase tracking-label text-support hover:text-accent">Review rider and custody →</Link> : null}</div></article>)}</div>}</section>

    <section className="py-10"><h2 className="text-h3 font-bold">Rider records</h2>{riders.length === 0 ? <p className="mt-4 text-ink-soft">No rider applications yet.</p> : <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[70rem] border-collapse"><thead><tr className="border-b border-ink text-left">{['Rider','Status','Vehicle','Trust','Exposure','Deliveries','Incidents',''].map(h => <th key={h} className="py-3 pr-6 font-mono text-micro uppercase tracking-label text-ink-faint">{h}</th>)}</tr></thead><tbody>{riders.map(r => { const limit = r.maxExposureOverrideAmount ?? r.trustExposureLimitAmount; return <tr key={r.id} className="border-b border-rule align-top"><td className="py-4 pr-6"><span className="font-mono text-small font-bold">{r.publicRiderId}</span><span className="mt-1 block">{r.displayName}</span></td><td className="py-4 pr-6 text-small">{r.accountStatus}<span className="mt-1 block text-ink-faint">{r.verificationStatus} · {r.availability}</span></td><td className="py-4 pr-6 text-small">{r.vehicleType ?? 'Not recorded'}</td><td className="py-4 pr-6 text-small">{r.trustLevel ? `Level ${r.trustLevel}` : 'Not set'}</td><td className="py-4 pr-6 font-mono text-small">{format({ amount: r.currentExposureAmount, currency: r.currency })}<span className="mt-1 block text-ink-faint">of {limit == null ? 'not set' : format({ amount: limit, currency: r.currency })}</span></td><td className="py-4 pr-6 text-small">{r.activeDeliveries} active · {r.completedDeliveries} complete · {r.failedDeliveries} failed</td><td className="py-4 pr-6 text-small">{r.incidentCount}</td><td className="py-4"><Link href={`/admin/riders/${r.id}`} className="font-mono text-micro uppercase tracking-label text-support hover:text-accent">Review →</Link></td></tr>})}</tbody></table></div>}</section>
  </main>
}
