'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Logo } from '@/app/components/Logo'

/**
 * The approved one-page homepage, wired to the real system.
 *
 * WHAT CHANGED FROM DesignPreview, AND WHY.
 *
 * The markup, classes and copy of the home screen are preserved exactly — this
 * is the approved design and it is not being redesigned. What has gone is the
 * simulation behind it:
 *
 *   - DEMO_PRODUCTS, a hard-coded catalogue with invented prices
 *   - a cart held in React state
 *   - `loggedIn`, a boolean flipped by clicking "Create account", which is to
 *     say an authentication system anybody could satisfy
 *   - an order confirmation reading MM-DEMO-001 that wrote nothing anywhere
 *
 * Every one of those screens already exists for real, built to the same
 * design: /shop, /cart, /checkout, /login, /team-access, /management-access.
 * So the buttons now go there instead of to a local state machine. A customer
 * who clicks "Shop now" reaches the actual catalogue; if it is empty, it says
 * so, which is the truth.
 *
 * The cart badge reads the real cart through /api/cart, so it survives a
 * refresh and matches what checkout will charge for.
 *
 * The layout's own Nav, Footer and StaffBar sit behind this overlay
 * (`fixed inset-0`), which is why this keeps its own nav and its own footer
 * links to staff and management. Those are real routes now, not screens.
 */
export function HomeShell() {
  const [itemCount, setItemCount] = useState(0)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/cart', { cache: 'no-store' })
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled) setItemCount(body?.data?.itemCount ?? 0)
      })
      .catch(() => {
        // A cart that cannot be read shows nothing rather than a wrong number.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const search = (event: React.FormEvent) => {
    event.preventDefault()
    const term = query.trim()
    window.location.href = term
      ? `/shop?q=${encodeURIComponent(term)}`
      : '/shop'
  }

  return (
    <div className="fixed inset-0 z-[100] min-h-dvh overflow-y-auto bg-paper">
      <nav className="sticky top-0 z-[60] border-b border-rule bg-white/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-[86rem] items-center gap-5 px-gutter py-4 lg:gap-8">
          <Link href="/" aria-label="Muroora Mart home" className="shrink-0 text-left">
            <Logo className="h-12" />
            <span className="mt-1 hidden text-[0.65rem] font-medium text-support sm:block">Modern local shopping · Mutare</span>
          </Link>

          <div className="ml-auto hidden items-center gap-7 lg:flex">
            <Link href="/shop" className="text-small font-medium text-support hover:text-accent">Shop</Link>
            <Link href="/about" className="text-small font-medium text-support hover:text-accent">How It Works</Link>
            <Link href="/diaspora" className="text-small font-medium text-support hover:text-accent">Diaspora</Link>
            <Link href="/about" className="text-small font-medium text-support hover:text-accent">About</Link>
            <Link href="/contact" className="text-small font-medium text-support hover:text-accent">Contact</Link>
          </div>

          <form onSubmit={search} className="ml-auto hidden min-h-11 w-52 items-center gap-3 rounded-md bg-paper-sunk px-4 xl:flex">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products..." aria-label="Search products" className="min-w-0 flex-1 bg-transparent text-small outline-none" />
          </form>

          <Link href="/account" className="inline-flex min-h-11 shrink-0 items-center gap-2 text-small font-medium text-support hover:text-accent">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="7" r="3.5"/><path d="M5 21c.6-4.6 2.9-7 7-7s6.4 2.4 7 7"/></svg>
            <span className="hidden sm:inline">Log in</span>
          </Link>
          <Link href="/cart" aria-label={`Cart with ${itemCount} items`} className="relative inline-flex size-11 shrink-0 items-center justify-center text-support">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6.5 8.5h11l1 12h-13l1-12Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>
            <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-accent text-[0.65rem] font-bold text-white">{itemCount}</span>
          </Link>
        </div>
      </nav>

      <main>
        <section className="grid min-h-[32rem] border-b border-rule bg-[#fbfaf6] lg:grid-cols-2">
          <div className="flex items-center px-gutter py-16 lg:justify-end lg:py-20">
            <div className="w-full max-w-[38rem] lg:pr-12">
              <h1 className="max-w-[12ch] text-mega leading-[1.02] text-support">The shopping gets <span className="text-accent">done</span>, wherever you are.</h1>
              <p className="mt-6 max-w-[48ch] text-lead text-ink-soft">Shop quality products from Muroora Mart in Mutare. We&rsquo;ll prepare and deliver to your door or to someone you care about.</p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/shop" className="bg-accent px-9 py-4 font-mono text-micro font-bold uppercase tracking-label text-white hover:bg-accent-deep">Shop now</Link>
                <Link href="/login" className="border border-support px-9 py-4 font-mono text-micro font-bold uppercase tracking-label text-support hover:bg-support hover:text-white">Log in</Link>
              </div>
            </div>
          </div>
          <div className="relative min-h-[24rem] lg:min-h-full">
            <Image src="/hero/courtyard.png" alt="Traveller arriving at a Zimbabwean courtyard" fill priority className="object-cover object-[58%_50%]" />
            <div aria-hidden className="absolute inset-y-0 left-0 hidden w-20 bg-gradient-to-r from-[#fbfaf6] to-transparent lg:block" />
          </div>
        </section>

        <section className="bg-[#fffdfa] px-gutter py-12 md:py-16">
          <div className="mx-auto max-w-[76rem] text-center">
            <p className="font-mono text-micro font-bold uppercase tracking-[0.3em] text-accent">How Muroora works</p>
            <h2 className="mt-4 text-h1 text-support">Real goods. A real recipient. One clear order.</h2>
            <div className="mt-12 grid gap-8 text-left md:grid-cols-3 md:gap-0">
              {[
                ['Choose what they need', 'Browse products and add them to your cart.'],
                ['Tell us who receives it', 'Provide their details and delivery address.'],
                ['Muroora prepares delivery', 'We pick, pack and deliver with care.'],
              ].map(([title, body], index) => (
                <article key={title} className="relative px-7 py-3 md:border-r md:border-rule md:last:border-r-0">
                  <span className="block font-mono text-[2rem] font-extrabold leading-none text-accent">0{index + 1}</span>
                  <h3 className="mt-5 text-h4 font-bold text-support">{title}</h3>
                  <p className="mt-3 text-ink-soft">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-auto border-t border-rule bg-paper-sunk px-gutter py-8 text-center">
        <p className="text-small text-ink-faint">Muroora Mart · Modern local shopping in Mutare</p>
        <div className="mt-3 flex justify-center gap-6">
          <Link href="/team-access" className="font-mono text-[0.62rem] uppercase tracking-label text-ink-faint transition-colors hover:text-support">Staff login</Link>
          <Link href="/management-access" className="font-mono text-[0.62rem] uppercase tracking-label text-ink-faint transition-colors hover:text-support">Admin login</Link>
        </div>
      </footer>
    </div>
  )
}
