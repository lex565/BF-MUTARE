import type { Metadata } from 'next'
import Link from 'next/link'

import { ApplyForm } from './ApplyForm'

export const metadata: Metadata = { title: 'List your business' }
export const dynamic = 'force-dynamic'

export default function ApplyPage() {
  return (
    <main className="mx-auto max-w-[86rem] px-gutter py-12">
      <Link
        href="/marketplace"
        className="font-mono text-micro uppercase tracking-label text-support"
      >
        ← Marketplace
      </Link>
      <p className="mt-10 font-mono text-micro uppercase tracking-label text-accent">
        Musuwo for business
      </p>
      <h1 className="mt-3 text-mega leading-none">Tell Musuwo about your business</h1>
      <p className="mt-5 max-w-[55ch] text-lead text-ink-soft">
        Listing is free while Musuwo is new. Fill this in and somebody will
        read it.
      </p>
      <div className="mt-10">
        <ApplyForm />
      </div>
    </main>
  )
}
