import Link from 'next/link'

import { MusuwoLogo } from '@/app/components/MusuwoLogo'

export default function AccessPage() {
  return (
    <main className="min-h-[calc(100dvh-5rem)] bg-paper-sunk px-gutter py-14">
      <div className="mx-auto max-w-[64rem]">
        <Link href="/" className="inline-flex"><MusuwoLogo /></Link>
        <div className="mt-12 text-center">
          <p className="font-mono text-micro font-bold uppercase tracking-[0.3em] text-accent">Choose your Musuwo account</p>
          <h1 className="mt-4 text-mega leading-none text-support">How are you using Musuwo?</h1>
          <p className="mx-auto mt-5 max-w-[55ch] text-lead text-ink-soft">Your individual shopping space and business workspace stay separate, even when the same person uses both.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <Link href="/login?next=/account" className="group rounded-2xl border border-rule bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:border-accent">
            <span className="flex size-14 items-center justify-center rounded-full bg-accent-wash text-2xl">🧺</span>
            <p className="mt-7 font-mono text-micro font-bold uppercase tracking-label text-accent">Personal shopping</p>
            <h2 className="mt-3 text-h2 text-support">Log in as an individual</h2>
            <p className="mt-4 text-ink-soft">Browse products, shop from businesses, send orders to family and track deliveries.</p>
            <strong className="mt-7 inline-block text-accent">Continue as individual →</strong>
          </Link>
          <Link href="/management-access" className="group rounded-2xl bg-support p-8 text-white shadow-sm transition hover:-translate-y-1">
            <span className="flex size-14 items-center justify-center rounded-full bg-white/10 text-2xl">🏪</span>
            <p className="mt-7 font-mono text-micro font-bold uppercase tracking-label text-[#ffb37a]">Store management</p>
            <h2 className="mt-3 text-h2 text-white">Log in as a business</h2>
            <p className="mt-4 text-white/70">Manage your business profile, products, prices, orders and availability.</p>
            <strong className="mt-7 inline-block text-[#ffb37a]">Continue as business →</strong>
          </Link>
        </div>
        <p className="mt-8 text-center text-small text-ink-faint">Want to register a business? <Link href="/marketplace" className="font-bold text-support underline">Start a Musuwo business application</Link>.</p>
      </div>
    </main>
  )
}
