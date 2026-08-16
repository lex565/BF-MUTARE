import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requireAdminView } from '@/lib/auth'
import { format } from '@/lib/money'
import { getRiderAdminDetail, listTrustLevels, RiderError } from '@/lib/services/riders'
import { DeliveryResolutionForm, IncidentReviewForm, RiderManagementForms } from '../RiderForms'

export const metadata: Metadata = { title: 'Rider record', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'
const when = (date: Date | null) => date ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date) : '—'

export default async function RiderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminView()
  const { id } = await params
  let detail
  try { detail = await getRiderAdminDetail(id) } catch (error) { if (error instanceof RiderError && error.code === 'NOT_FOUND') notFound(); throw error }
  const levels = await listTrustLevels()
  const { rider } = detail
  const limit = rider.maxExposureOverrideAmount ?? rider.trustExposureLimitAmount
  return <main className="mx-auto max-w-[86rem] px-gutter py-12">
    <header className="border-b border-rule pb-8"><Link href="/admin/riders" className="font-mono text-micro uppercase tracking-label text-support">← All riders</Link><p className="mt-6 font-mono text-micro uppercase tracking-label text-ink-faint">{rider.publicRiderId}</p><h1 className="mt-2 text-h1">{rider.displayName}</h1><p className="mt-3 text-ink-soft">{rider.accountStatus} · {rider.verificationStatus} · {rider.availability}</p><dl className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">{[['Vehicle', rider.vehicleType ?? 'Not recorded'], ['Trust', rider.trustLevel ? `Level ${rider.trustLevel}` : 'Not set'], ['Current exposure', format({ amount: rider.currentExposureAmount, currency: rider.currency })], ['Maximum exposure', limit == null ? 'Not set' : format({ amount: limit, currency: rider.currency })], ['Approved', when(rider.approvedAt)]].map(([label,value]) => <div key={label}><dt className="font-mono text-micro uppercase tracking-label text-ink-faint">{label}</dt><dd className="mt-1 font-bold">{value}</dd></div>)}</dl></header>
    <section className="border-b border-rule py-10"><h2 className="text-h3 font-bold">Management controls</h2><p className="mt-3 max-w-measure text-ink-soft">Every status, trust, restriction and limit decision needs a reason and is written to the audit history.</p><RiderManagementForms rider={rider} levels={levels} /></section>
    <section className="border-b border-rule py-10"><h2 className="text-h3 font-bold">Deliveries and custody</h2>{detail.deliveries.length === 0 ? <p className="mt-4 text-ink-soft">No delivery history.</p> : <div className="mt-6 space-y-5">{detail.deliveries.map(d => <article key={d.id} className="border border-rule p-5"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-mono text-small font-bold">Delivery {d.id.slice(0, 8)}</p><p className="mt-1 text-small text-ink-soft">{d.status} · {d.custodyState} · {format({ amount: d.merchandiseValueAmount, currency: d.currency })}</p></div><p className="font-mono text-micro text-ink-faint">{when(d.createdAt)}</p></div>{['IN_RIDER_CUSTODY','DELIVERY_FAILED','RETURNING_TO_STORE','DAMAGED','DISPUTED'].includes(d.custodyState) && <div className="mt-4"><DeliveryResolutionForm deliveryId={d.id} riderId={rider.id} /></div>}</article>)}</div>}</section>
    <section className="border-b border-rule py-10"><h2 className="text-h3 font-bold">Incidents</h2>{detail.incidents.length === 0 ? <p className="mt-4 text-ink-soft">No reported incidents.</p> : <div className="mt-5 space-y-4">{detail.incidents.map(i => <article key={i.id} className="border border-rule p-5"><p className="font-mono text-micro uppercase tracking-label text-accent">{i.category} · {i.status}</p><p className="mt-3">{i.note}</p>{i.resolutionNote && <p className="mt-2 text-small text-ink-soft">Review: {i.resolutionNote}</p>}<IncidentReviewForm incidentId={i.id} riderId={rider.id} /></article>)}</div>}</section>
    <section className="border-b border-rule py-10"><h2 className="text-h3 font-bold">Exposure and overrides</h2><div className="mt-5 grid gap-8 lg:grid-cols-2"><div><h3 className="font-bold">Exposure ledger</h3>{detail.exposureHistory.length === 0 ? <p className="mt-3 text-small text-ink-soft">No custody exposure yet.</p> : <ol className="mt-3 space-y-3">{detail.exposureHistory.map(e => <li key={e.id} className="border-l-2 border-support pl-4 text-small"><strong>{e.eventType}</strong> · {format({ amount: e.amountAfter, currency: e.currency })}<span className="block text-ink-faint">{when(e.createdAt)}</span></li>)}</ol>}</div><div><h3 className="font-bold">Authorized overrides</h3>{detail.overrides.length === 0 ? <p className="mt-3 text-small text-ink-soft">No overrides.</p> : <ol className="mt-3 space-y-3">{detail.overrides.map(o => <li key={o.id} className="border-l-2 border-accent pl-4 text-small"><strong>{format({ amount: o.resultingExposureAmount, currency: o.currency })}</strong><span className="block">{o.reason}</span><span className="block text-ink-faint">{when(o.createdAt)}</span></li>)}</ol>}</div></div></section>
    <section className="py-10"><h2 className="text-h3 font-bold">Custody timeline</h2>{detail.custodyHistory.length === 0 ? <p className="mt-4 text-ink-soft">No custody events.</p> : <ol className="mt-5 space-y-3">{detail.custodyHistory.map(e => <li key={e.id} className="grid gap-2 border-b border-rule pb-3 text-small sm:grid-cols-[12rem_1fr_auto]"><span className="font-mono">{e.previousState ?? 'START'} → {e.newState}</span><span>{e.reason ?? 'Recorded custody transition'}</span><span className="text-ink-faint">{when(e.createdAt)}</span></li>)}</ol>}</section>
  </main>
}
