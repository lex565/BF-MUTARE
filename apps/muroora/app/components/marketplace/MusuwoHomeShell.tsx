'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Logo } from '@/app/components/Logo'
import { MusuwoLogo } from '@/app/components/MusuwoLogo'

type BusinessSlide = {
  id: string
  name: string
  description: string
  location: string
  category: string
  href: string
  score: number
  founding?: boolean
}

// Preview seed. The production feed will replace this array with approved
// business records; the carousel itself does not need to change.
const INITIAL_BUSINESSES: BusinessSlide[] = [
  {
    id: 'muroora-mart',
    name: 'Muroora Mart',
    description: 'Quality groceries and everyday essentials, prepared locally and delivered through Musuwo.',
    location: 'Mutare, Zimbabwe',
    category: 'Groceries & household',
    href: '/stores/muroora-mart',
    score: 4.5,
    founding: true,
  },
]

export function MusuwoHomeShell() {
  const [query, setQuery] = useState('')
  const [activeBusiness, setActiveBusiness] = useState(0)
  const businesses = INITIAL_BUSINESSES

  useEffect(() => {
    if (businesses.length < 2) return
    const timer = window.setInterval(
      () => setActiveBusiness((current) => (current + 1) % businesses.length),
      5000,
    )
    return () => window.clearInterval(timer)
  }, [businesses.length])

  const search = (event: React.FormEvent) => {
    event.preventDefault()
    const term = query.trim()
    window.location.href = term
      ? `/marketplace?q=${encodeURIComponent(term)}`
      : '/marketplace'
  }

  return (
    <div className="fixed inset-0 z-[100] min-h-dvh overflow-y-auto bg-paper">
      <nav className="sticky top-0 z-[60] border-b border-rule bg-white/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-[86rem] items-center gap-5 px-gutter py-4 lg:gap-8">
          <Link href="/" aria-label="Musuwo home" className="shrink-0 text-left">
            <MusuwoLogo />
            <span className="mt-1 hidden text-[0.65rem] font-medium text-support sm:block">Zimbabwe&rsquo;s local business gateway</span>
          </Link>

          <div className="ml-auto hidden items-center gap-7 lg:flex">
            <Link href="#businesses" className="text-small font-medium text-support hover:text-accent">Businesses</Link>
            <Link href="/shop" className="text-small font-medium text-support hover:text-accent">Shop</Link>
            <Link href="#how-it-works" className="text-small font-medium text-support hover:text-accent">How It Works</Link>
          </div>

          <form onSubmit={search} className="ml-auto hidden min-h-11 w-52 items-center gap-3 rounded-md bg-paper-sunk px-4 xl:flex">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search businesses..." aria-label="Search businesses" className="min-w-0 flex-1 bg-transparent text-small outline-none" />
          </form>

          <Link href="/access" className="inline-flex min-h-11 shrink-0 items-center gap-2 text-small font-medium text-support hover:text-accent">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="7" r="3.5"/><path d="M5 21c.6-4.6 2.9-7 7-7s6.4 2.4 7 7"/></svg>
            <span className="hidden sm:inline">Log in</span>
          </Link>
        </div>
      </nav>

      <main>
        <section className="relative isolate flex min-h-[36rem] items-center overflow-hidden border-b border-[#d66b2a] bg-[radial-gradient(circle_at_82%_22%,#ffcb65_0%,#f79432_25%,#9f421f_58%,#3b2118_100%)] lg:min-h-[42rem]">
          <div aria-hidden className="absolute -right-28 top-1/2 -z-10 size-[38rem] -translate-y-1/2 rounded-full border border-white/15 bg-white/10 blur-sm lg:right-8 lg:size-[44rem]" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-[#271811]/95 via-[#4b2619]/70 to-transparent" />
          <div className="pointer-events-none absolute inset-y-8 right-[-9rem] -z-10 w-[42rem] opacity-20 sm:right-[-5rem] md:opacity-35 lg:right-[2%] lg:w-[48rem] lg:opacity-90">
            <Image src="/musuwo-logo.png" alt="" fill priority sizes="(min-width: 1024px) 48rem, 42rem" className="object-contain drop-shadow-[0_28px_45px_rgba(31,16,8,0.28)]" />
          </div>

          <div className="w-full px-gutter py-16 lg:py-20">
            <div className="mx-auto w-full max-w-[86rem]">
              <div className="max-w-[40rem] rounded-2xl border border-white/10 bg-[#21130d]/20 p-1 backdrop-blur-[2px]">
                <p className="mb-5 font-mono text-micro font-bold uppercase tracking-[0.3em] text-[#ffb37a]">One gateway. Many local businesses.</p>
                <h1 className="max-w-[13ch] text-mega leading-[1.02] text-white [text-shadow:0_2px_18px_rgb(0_0_0/0.45)]">Everything local, through <span className="text-[#ffb37a]">Musuwo.</span></h1>
                <p className="mt-6 max-w-[50ch] text-lead text-white/90 [text-shadow:0_1px_10px_rgb(0_0_0/0.5)]">Discover trusted Zimbabwean shops, food, accommodation and services. Buy from each business while Musuwo brings the experience together.</p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <Link href="/shop" className="bg-accent px-9 py-4 font-mono text-micro font-bold uppercase tracking-label text-white hover:bg-accent-deep">Shop now</Link>
                  <Link href="/access" className="border border-white/80 bg-white/10 px-9 py-4 font-mono text-micro font-bold uppercase tracking-label text-white backdrop-blur-sm transition-colors hover:bg-white hover:text-support">Log in</Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-rule bg-support px-gutter py-9 text-white">
          <div className="mx-auto flex max-w-[76rem] flex-wrap items-center justify-between gap-7">
            <div>
              <p className="font-mono text-micro font-bold uppercase tracking-[0.3em] text-[#ffb37a]">Shop by business category</p>
              <h2 className="mt-2 text-h3">Categories grow as approved businesses join.</h2>
            </div>
            <Link href="/shop" className="flex min-w-64 items-center gap-5 rounded-xl bg-white p-4 text-ink shadow-lg transition-transform hover:-translate-y-1">
              <span className="flex size-16 items-center justify-center rounded-lg bg-paper-sunk"><Logo className="h-10 max-w-14" /></span>
              <span><strong className="block text-h4 text-support">Groceries</strong><small className="mt-1 block text-ink-faint">Muroora Mart · Shop now →</small></span>
            </Link>
          </div>
        </section>

        <section id="businesses" className="overflow-hidden bg-[#fffdfa] px-gutter py-14 md:py-20">
          <div className="mx-auto max-w-[76rem]">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="font-mono text-micro font-bold uppercase tracking-[0.3em] text-accent">Businesses on Musuwo</p>
                <h2 className="mt-4 text-h1 text-support">Meet the businesses already here.</h2>
              </div>
              <Link href="/marketplace" className="font-mono text-micro font-bold uppercase tracking-label text-accent hover:text-accent-deep">View marketplace →</Link>
            </div>

            <div className="mt-10 overflow-hidden rounded-xl border border-rule bg-white shadow-sm" aria-roledescription="carousel" aria-label="Businesses on Musuwo">
              <div className="flex transition-transform duration-700 ease-out" style={{ transform: `translateX(-${activeBusiness * 100}%)` }}>
                {businesses.map((business) => (
                  <article key={business.id} className="w-full shrink-0 p-6 md:p-10">
                    <div className="grid items-center gap-8 md:grid-cols-[0.8fr_1.2fr]">
                      <div className="flex min-h-52 items-center justify-center rounded-lg bg-paper-sunk p-8">
                        {business.id === 'muroora-mart' ? <Logo className="h-28 max-w-full" /> : <span className="text-h2 text-support">{business.name}</span>}
                      </div>
                      <div>
                        <div className="flex flex-wrap gap-2">
                          {business.founding && <span className="rounded-full bg-accent/10 px-3 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-label text-accent">Founding business</span>}
                          <span className="rounded-full bg-paper-sunk px-3 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-label text-support">{business.category}</span>
                        </div>
                        <h3 className="mt-5 text-h1 text-support">{business.name}</h3>
                        <p className="mt-3 max-w-[52ch] text-ink-soft">{business.description}</p>
                        <div className="mt-5 flex flex-wrap items-center gap-5 text-small text-ink-faint">
                          <span>★ <strong className="text-support">{business.score.toFixed(1)}</strong> Musuwo Business Score</span>
                          <span>{business.location}</span>
                        </div>
                        <p className="mt-2 text-micro text-ink-faint">Launch assessment · customer reviews will build over time</p>
                        <Link href={business.href} className="mt-7 inline-flex bg-accent px-7 py-3 font-mono text-micro font-bold uppercase tracking-label text-white hover:bg-accent-deep">Enter store</Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-4">
              <div className="flex gap-2" aria-label="Choose a business slide">
                {businesses.map((business, index) => (
                  <button key={business.id} type="button" onClick={() => setActiveBusiness(index)} aria-label={`Show ${business.name}`} aria-current={activeBusiness === index} className={`h-2 rounded-full transition-all ${activeBusiness === index ? 'w-8 bg-accent' : 'w-2 bg-rule'}`} />
                ))}
              </div>
              <p className="text-small text-ink-faint">New approved businesses will join this showcase automatically.</p>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-t border-rule bg-paper-sunk px-gutter py-12 md:py-16">
          <div className="mx-auto max-w-[76rem] text-center">
            <p className="font-mono text-micro font-bold uppercase tracking-[0.3em] text-accent">How Musuwo works</p>
            <h2 className="mt-4 text-h1 text-support">Discover. Choose. Buy with confidence.</h2>
            <div className="mt-12 grid gap-8 text-left md:grid-cols-3 md:gap-0">
              {[
                ['Find a local business', 'Browse one marketplace for shops, food, stays and services.'],
                ['Enter its storefront', 'See that business\'s own products, prices and personality.'],
                ['Complete your order', 'Buy from the business while Musuwo coordinates the experience.'],
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

      <footer className="border-t border-rule bg-paper-sunk px-gutter py-8 text-center">
        <p className="text-small text-ink-faint">Musuwo · Zimbabwe&rsquo;s local business gateway</p>
        <div className="mt-3 flex justify-center gap-6">
          <Link href="/access?type=individual" className="font-mono text-[0.62rem] uppercase tracking-label text-ink-faint hover:text-support">Individual account</Link>
          <Link href="/access?type=business" className="font-mono text-[0.62rem] uppercase tracking-label text-ink-faint hover:text-support">Musuwo Business account</Link>
        </div>
      </footer>
    </div>
  )
}
