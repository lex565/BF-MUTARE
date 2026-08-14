'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { FINANCE, SITE, whatsappLink } from '@/app/data/site'
import { Logo } from '@/app/components/Logo'

/** Real routes, not hash anchors — each is its own page. */
const LINKS = [
  { href: '/deliveries', label: 'Deliveries' },
  { href: '/about', label: 'About' },
  { href: '/team', label: 'Team' },
  { href: '/journal', label: 'Journal' },
  { href: '/contact', label: 'Contact' },
]

export function Nav() {
  const pathname = usePathname()
  const [lifted, setLifted] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      {/* The payment plan ribbon. It sits above the nav, in plate yellow, on
          every page — this is the offer that makes someone stop scrolling, so
          it does not get buried in a section halfway down the home page. */}
      <Link
        href="/contact"
        className="group block bg-accent text-paper transition-colors duration-200 hover:bg-accent-deep"
      >
        <p className="mx-auto flex max-w-[86rem] flex-wrap items-center justify-center gap-x-3 gap-y-1 px-gutter py-2 text-center font-mono text-micro font-bold uppercase tracking-label">
          {FINANCE.headline}
          <span aria-hidden className="hidden h-3 w-px bg-paper/40 sm:block" />
          <span className="font-normal normal-case tracking-normal opacity-90">
            {FINANCE.support}
          </span>
          <span
            aria-hidden
            className="transition-transform duration-300 ease-[var(--ease-out-quint)] group-hover:translate-x-1"
          >
            →
          </span>
        </p>
      </Link>

      <div
        className={`transition-[background-color,border-color,backdrop-filter] duration-300 ${
          lifted
            ? 'border-b border-rule bg-paper/90 backdrop-blur-md'
            : 'border-b border-transparent'
        }`}
      >
        <nav
          aria-label="Primary"
          className="mx-auto flex max-w-[86rem] items-center justify-between px-gutter py-4"
        >
          <Link href="/" aria-label="BF Mutare — home">
            <Logo />
          </Link>

          <ul className="hidden items-center gap-8 md:flex">
            {LINKS.map((link) => {
              const active = isActive(link.href)
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={`group relative font-mono text-micro uppercase tracking-label transition-colors duration-200 ${
                      active ? 'text-ink' : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    {link.label}
                    <span
                      className={`absolute -bottom-1.5 left-0 h-px bg-accent transition-[width] duration-300 ease-[var(--ease-out-quint)] ${
                        active ? 'w-full' : 'w-0 group-hover:w-full'
                      }`}
                    />
                  </Link>
                </li>
              )
            })}
            <li>
              <a
                href={whatsappLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-accent px-4 py-2 font-mono text-micro uppercase tracking-label text-accent transition-colors duration-200 hover:bg-accent hover:text-paper"
              >
                WhatsApp
              </a>
            </li>
          </ul>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="md:hidden"
          >
            <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
            <span aria-hidden className="flex h-5 w-6 flex-col justify-between">
              <span
                className={`h-px w-full bg-ink transition-transform duration-300 ease-[var(--ease-in-out-quart)] ${open ? 'translate-y-[9px] rotate-45' : ''}`}
              />
              <span
                className={`h-px w-full bg-ink transition-opacity duration-200 ${open ? 'opacity-0' : ''}`}
              />
              <span
                className={`h-px w-full bg-ink transition-transform duration-300 ease-[var(--ease-in-out-quart)] ${open ? '-translate-y-[9px] -rotate-45' : ''}`}
              />
            </span>
          </button>
        </nav>
      </div>

      <div
        id="mobile-nav"
        className={`grid overflow-hidden bg-paper transition-[grid-template-rows] duration-400 ease-[var(--ease-in-out-quart)] md:hidden ${
          open ? 'grid-rows-[1fr] border-t border-rule' : 'grid-rows-[0fr]'
        }`}
      >
        <ul className="min-h-0">
          {LINKS.map((link) => (
            <li key={link.href} className="border-b border-rule last:border-0">
              <Link
                href={link.href}
                /* Closed here rather than in an effect watching the pathname —
                   the click is the event, and reacting to the route change
                   afterwards is a cascading render for the same result. */
                onClick={() => setOpen(false)}
                className="block px-gutter py-4 font-display text-h4 uppercase tracking-tight"
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li className="px-gutter py-4">
            <a
              href={whatsappLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-accent px-4 py-3 text-center font-mono text-small font-bold uppercase tracking-label text-paper"
            >
              WhatsApp {SITE.phoneDisplay}
            </a>
          </li>
        </ul>
      </div>
    </header>
  )
}
