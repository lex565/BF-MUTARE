'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import {
  moneyLabel,
  type ApiEnvelope,
  type CartData,
  type WireMoney,
} from './types'

interface DeliveryZone {
  id: string
  name: string
  description: string | null
  suburbs: string[]
  fee: WireMoney
  minimumOrder: WireMoney
  estimatedMinutesMin: number | null
  estimatedMinutesMax: number | null
}

interface DeliveryQuote {
  zone: Pick<DeliveryZone, 'id' | 'name' | 'estimatedMinutesMin' | 'estimatedMinutesMax'>
  fee: WireMoney
  minimumOrder: WireMoney
  belowMinimum: boolean
  shortfall: WireMoney | null
  deliverable: boolean
}

interface PlacedOrder {
  orderNumber: string
  status: string
  customerStatus: string
  subtotal: WireMoney
  deliveryFee: WireMoney
  total: WireMoney
  itemCount: number
  recipientName: string
  deliverySuburb: string
  zoneName: string
  estimatedMinutesMin: number | null
  estimatedMinutesMax: number | null
  placedAt: string
  replayed: boolean
}

interface CheckoutForm {
  buyerName: string
  buyerEmail: string
  buyerPhone: string
  buyerCountry: string
  sameRecipient: boolean
  recipientName: string
  recipientPhone: string
  relationship: string
  line1: string
  line2: string
  suburb: string
  directions: string
  alternativeContactName: string
  alternativeContactPhone: string
  substitutionPreference: 'NONE' | 'SIMILAR' | 'CONTACT_ME'
  customerNote: string
}

const initialForm: CheckoutForm = {
  buyerName: '',
  buyerEmail: '',
  buyerPhone: '',
  buyerCountry: '+263',
  sameRecipient: true,
  recipientName: '',
  recipientPhone: '',
  relationship: '',
  line1: '',
  line2: '',
  suburb: '',
  directions: '',
  alternativeContactName: '',
  alternativeContactPhone: '',
  substitutionPreference: 'CONTACT_ME',
  customerNote: '',
}

const fieldClass =
  'mt-2 min-h-12 w-full border border-rule bg-white px-4 py-3 text-base outline-none transition-colors placeholder:text-ink-faint focus:border-support'
const labelClass = 'block text-small font-bold text-ink'

export function CheckoutView() {
  const [cart, setCart] = useState<CartData | null>(null)
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [form, setForm] = useState<CheckoutForm>(initialForm)
  const [quote, setQuote] = useState<DeliveryQuote | null>(null)
  const [loading, setLoading] = useState(true)
  const [quoting, setQuoting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [order, setOrder] = useState<PlacedOrder | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())

  useEffect(() => {
    let active = true
    Promise.all([
      fetch('/api/cart', { cache: 'no-store' }).then((response) => response.json()),
      fetch('/api/delivery/zones', { cache: 'no-store' }).then((response) => response.json()),
    ])
      .then(([cartPayload, zonePayload]: [ApiEnvelope<CartData>, ApiEnvelope<{ zones: DeliveryZone[] }>]) => {
        if (!active) return
        if ('error' in cartPayload) throw new Error(cartPayload.error.message)
        setCart(cartPayload.data)
        if ('data' in zonePayload) setZones(zonePayload.data.zones)
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Checkout could not be loaded.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const suburbOptions = useMemo(
    () =>
      zones
        .flatMap((zone) => zone.suburbs.map((suburb) => ({ suburb, zone: zone.name })))
        .sort((a, b) => a.suburb.localeCompare(b.suburb)),
    [zones],
  )

  function update<K extends keyof CheckoutForm>(key: K, value: CheckoutForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function selectSuburb(suburb: string) {
    update('suburb', suburb)
    setQuote(null)
    setError('')
    if (!suburb || !cart) return

    setQuoting(true)
    try {
      const params = new URLSearchParams({
        suburb,
        subtotal: cart.subtotal.amount,
      })
      const response = await fetch(`/api/delivery/zones?${params}`, {
        cache: 'no-store',
      })
      const payload = (await response.json()) as ApiEnvelope<DeliveryQuote>
      if (!response.ok || 'error' in payload) {
        throw new Error('error' in payload ? payload.error.message : 'Could not quote delivery.')
      }
      setQuote(payload.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not quote delivery.')
    } finally {
      setQuoting(false)
    }
  }

  async function place(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!cart || !quote?.deliverable) return

    setSubmitting(true)
    setError('')
    try {
      const recipientName = form.sameRecipient ? form.buyerName : form.recipientName
      const recipientPhone = form.sameRecipient ? form.buyerPhone : form.recipientPhone
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyer: {
            name: form.buyerName,
            email: form.buyerEmail,
            phone: form.buyerPhone,
            countryCode: form.buyerCountry,
          },
          recipient: {
            name: recipientName,
            phone: recipientPhone,
            relationship: form.sameRecipient ? undefined : form.relationship || undefined,
            line1: form.line1,
            line2: form.line2 || undefined,
            suburb: form.suburb,
            city: 'Mutare',
            directions: form.directions || undefined,
            alternativeContactName: form.alternativeContactName || undefined,
            alternativeContactPhone: form.alternativeContactPhone || undefined,
          },
          idempotencyKey,
          substitutionPreference: form.substitutionPreference,
          customerNote: form.customerNote || undefined,
        }),
      })
      const payload = (await response.json()) as ApiEnvelope<PlacedOrder>
      if (!response.ok || 'error' in payload) {
        throw new Error('error' in payload ? payload.error.message : 'Could not place your order.')
      }

      setOrder(payload.data)
      setIdempotencyKey(crypto.randomUUID())
      window.dispatchEvent(
        new CustomEvent('muroora:cart', {
          detail: { ...cart, itemCount: 0, lines: [] },
        }),
      )
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not place your order.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="h-96 animate-pulse bg-paper-sunk" aria-label="Loading checkout" />
  }

  if (order) {
    return (
      <section className="mx-auto max-w-3xl border border-rule bg-paper p-7 shadow-[0_24px_70px_rgba(18,39,27,0.12)] md:p-12">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-support text-2xl text-white" aria-hidden>
          ✓
        </span>
        <p className="mt-7 font-mono text-micro font-bold uppercase tracking-label text-support">
          Order received
        </p>
        <h1 className="mt-3 text-mega leading-none">Thank you.</h1>
        <p className="mt-5 text-lead text-ink-soft">
          Your order for {order.recipientName} has been recorded. Keep the order
          number below—it is the quickest way to ask Muroora about this delivery.
        </p>

        <div className="mt-8 grid gap-px bg-rule sm:grid-cols-2">
          <div className="bg-paper-sunk p-5">
            <p className="font-mono text-micro uppercase tracking-label text-ink-faint">Order number</p>
            <p className="mt-2 text-h3 font-extrabold">{order.orderNumber}</p>
          </div>
          <div className="bg-paper-sunk p-5">
            <p className="font-mono text-micro uppercase tracking-label text-ink-faint">Current status</p>
            <p className="mt-2 text-h3 font-extrabold">{order.customerStatus}</p>
          </div>
          <div className="bg-paper-sunk p-5">
            <p className="font-mono text-micro uppercase tracking-label text-ink-faint">Delivery area</p>
            <p className="mt-2 font-bold">{order.deliverySuburb} · {order.zoneName}</p>
          </div>
          <div className="bg-paper-sunk p-5">
            <p className="font-mono text-micro uppercase tracking-label text-ink-faint">Order total</p>
            <p className="mt-2 text-h3 font-extrabold">{moneyLabel(order.total)}</p>
          </div>
        </div>

        <div className="mt-8 border-l-4 border-accent bg-accent-wash p-5">
          <p className="font-bold">Payment is not taken on this prototype.</p>
          <p className="mt-1 text-small text-ink-soft">
            Muroora will add the confirmed payment method later. No unsupported provider has been shown or charged.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link href="/shop" className="bg-accent px-7 py-4 font-mono text-micro font-bold uppercase tracking-label text-white hover:bg-accent-deep">
            Continue shopping
          </Link>
          <Link href="/account" className="border border-ink px-7 py-4 font-mono text-micro uppercase tracking-label hover:bg-ink hover:text-paper">
            View account
          </Link>
        </div>
      </section>
    )
  }

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="border border-rule bg-paper-sunk px-6 py-14 text-center">
        <h1 className="text-h2">There is nothing to check out yet</h1>
        <Link href="/shop" className="mt-6 inline-flex bg-accent px-7 py-4 font-mono text-micro uppercase tracking-label text-white">
          Go to the shop
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={place} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
      <div className="space-y-6">
        {error && (
          <p className="border border-red-300 bg-red-50 p-4 text-red-800" role="alert">{error}</p>
        )}

        <fieldset className="border border-rule bg-paper p-6 md:p-8">
          <legend className="px-2 font-mono text-micro font-bold uppercase tracking-label text-accent">1 · Who is buying?</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className={labelClass}>Full name<input required value={form.buyerName} onChange={(e) => update('buyerName', e.target.value)} className={fieldClass} autoComplete="name" /></label>
            <label className={labelClass}>Email<input required type="email" value={form.buyerEmail} onChange={(e) => update('buyerEmail', e.target.value)} className={fieldClass} autoComplete="email" /></label>
            <label className={labelClass}>Phone number<input required type="tel" value={form.buyerPhone} onChange={(e) => update('buyerPhone', e.target.value)} className={fieldClass} autoComplete="tel" /></label>
            <label className={labelClass}>Country code<select value={form.buyerCountry} onChange={(e) => update('buyerCountry', e.target.value)} className={fieldClass}><option value="+263">Zimbabwe (+263)</option><option value="+27">South Africa (+27)</option><option value="+44">United Kingdom (+44)</option><option value="+1">United States / Canada (+1)</option><option value="+61">Australia (+61)</option><option value="other">Other</option></select></label>
          </div>

          <label className="mt-7 flex cursor-pointer items-start gap-3 border border-rule bg-paper-sunk p-4">
            <input type="checkbox" checked={form.sameRecipient} onChange={(e) => update('sameRecipient', e.target.checked)} className="mt-1 size-5 accent-support" />
            <span><strong className="block">I am receiving this order</strong><span className="mt-1 block text-small text-ink-soft">Untick this when shopping for somebody else.</span></span>
          </label>

          {!form.sameRecipient && (
            <div className="mt-6 grid gap-5 border-l-4 border-support pl-5 sm:grid-cols-2">
              <label className={labelClass}>Recipient name<input required value={form.recipientName} onChange={(e) => update('recipientName', e.target.value)} className={fieldClass} /></label>
              <label className={labelClass}>Zimbabwe phone<input required type="tel" value={form.recipientPhone} onChange={(e) => update('recipientPhone', e.target.value)} className={fieldClass} placeholder="077… or +263…" /></label>
              <label className={`${labelClass} sm:col-span-2`}>Relationship <span className="font-normal text-ink-faint">(optional)</span><input value={form.relationship} onChange={(e) => update('relationship', e.target.value)} className={fieldClass} placeholder="e.g. Mum, brother, friend" /></label>
            </div>
          )}
        </fieldset>

        <fieldset className="border border-rule bg-paper p-6 md:p-8">
          <legend className="px-2 font-mono text-micro font-bold uppercase tracking-label text-accent">2 · Delivery in Mutare</legend>
          {zones.length === 0 ? (
            <div className="border border-orange-300 bg-orange-50 p-5">
              <p className="font-bold">Delivery areas are not configured yet</p>
              <p className="mt-2 text-small text-ink-soft">Checkout is working, but Muroora must add the real covered suburbs and fees before an order can be submitted.</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              <label className={`${labelClass} sm:col-span-2`}>House number and street<input required value={form.line1} onChange={(e) => update('line1', e.target.value)} className={fieldClass} autoComplete="address-line1" /></label>
              <label className={labelClass}>Address line 2 <span className="font-normal text-ink-faint">(optional)</span><input value={form.line2} onChange={(e) => update('line2', e.target.value)} className={fieldClass} autoComplete="address-line2" /></label>
              <label className={labelClass}>Suburb<select required value={form.suburb} onChange={(e) => void selectSuburb(e.target.value)} className={fieldClass}><option value="">Choose a covered suburb</option>{suburbOptions.map((item) => <option key={`${item.zone}-${item.suburb}`} value={item.suburb}>{item.suburb} — {item.zone}</option>)}</select></label>
              <label className={`${labelClass} sm:col-span-2`}>Directions <span className="font-normal text-ink-faint">(optional)</span><textarea value={form.directions} onChange={(e) => update('directions', e.target.value)} className={`${fieldClass} min-h-24`} placeholder="Gate colour, nearby landmark, or anything that helps the rider find the address." /></label>
            </div>
          )}

          {quoting && <p className="mt-5 text-small text-ink-soft" role="status">Checking the delivery area…</p>}
          {quote && (
            <div className={`mt-5 border p-5 ${quote.deliverable ? 'border-green-300 bg-green-50' : 'border-orange-300 bg-orange-50'}`}>
              <div className="flex flex-wrap justify-between gap-3"><div><p className="font-bold">{quote.zone.name}</p><p className="mt-1 text-small text-ink-soft">Delivery to {form.suburb}</p></div><p className="text-h4 font-extrabold">{moneyLabel(quote.fee)}</p></div>
              {quote.belowMinimum && quote.shortfall && <p className="mt-3 text-small font-bold text-accent-deep">Add {moneyLabel(quote.shortfall)} more to meet this area’s minimum order.</p>}
            </div>
          )}
        </fieldset>

        <fieldset className="border border-rule bg-paper p-6 md:p-8">
          <legend className="px-2 font-mono text-micro font-bold uppercase tracking-label text-accent">3 · If something is unavailable</legend>
          <div className="space-y-3">
            {[
              ['CONTACT_ME', 'Contact me first', 'Ask before changing the order.'],
              ['SIMILAR', 'Choose something similar', 'Muroora may suggest a close replacement.'],
              ['NONE', 'No substitutions', 'Remove anything that cannot be supplied.'],
            ].map(([value, title, note]) => (
              <label key={value} className="flex cursor-pointer items-start gap-3 border border-rule p-4 has-[:checked]:border-support has-[:checked]:bg-green-50">
                <input type="radio" name="substitution" value={value} checked={form.substitutionPreference === value} onChange={() => update('substitutionPreference', value as CheckoutForm['substitutionPreference'])} className="mt-1 size-4 accent-support" />
                <span><strong className="block">{title}</strong><span className="mt-1 block text-small text-ink-soft">{note}</span></span>
              </label>
            ))}
          </div>
          <label className={`${labelClass} mt-6`}>Order note <span className="font-normal text-ink-faint">(optional)</span><textarea value={form.customerNote} onChange={(e) => update('customerNote', e.target.value)} className={`${fieldClass} min-h-24`} /></label>
        </fieldset>
      </div>

      <aside className="border border-rule bg-paper-sunk p-6 lg:sticky lg:top-28">
        <p className="font-mono text-micro font-bold uppercase tracking-label text-accent">Review order</p>
        <ul className="mt-5 space-y-3 border-b border-rule pb-5">{cart.lines.map((line) => <li key={line.itemId} className="flex justify-between gap-4 text-small"><span>{line.quantity} × {line.name}</span><strong>{moneyLabel(line.lineTotal)}</strong></li>)}</ul>
        <dl className="mt-5 space-y-3"><div className="flex justify-between gap-4"><dt className="text-ink-soft">Merchandise</dt><dd className="font-bold">{moneyLabel(cart.subtotal)}</dd></div><div className="flex justify-between gap-4"><dt className="text-ink-soft">Delivery</dt><dd className="font-bold">{quote ? moneyLabel(quote.fee) : '—'}</dd></div></dl>
        <div className="mt-5 border-t border-rule pt-5"><p className="text-small text-ink-faint">Payment method</p><p className="mt-1 font-bold">To be configured</p><p className="mt-1 text-small text-ink-soft">No payment will be taken during this test.</p></div>
        <button type="submit" disabled={submitting || !quote?.deliverable || zones.length === 0 || cart.hasProblems} className="mt-7 min-h-12 w-full bg-accent px-6 py-4 font-mono text-micro font-bold uppercase tracking-label text-white hover:bg-accent-deep disabled:cursor-not-allowed disabled:bg-rule disabled:text-ink-faint">{submitting ? 'Placing order…' : 'Place test order'}</button>
        <p className="mt-3 text-center text-small text-ink-faint">Stock and delivery availability are checked again when you submit.</p>
      </aside>
    </form>
  )
}
