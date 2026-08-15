'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Logo } from '@/app/components/Logo'
import { CartLink } from '@/app/components/shop/CartLink'

const LINKS = [
  { href: '/shop', label: 'Shop' },
  { href: '/diaspora', label: 'Diaspora shopping' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
]

export function Nav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const isActive = (href: string) => pathname.startsWith(href)

  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-paper/95 backdrop-blur-md">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-[86rem] items-center justify-between px-gutter py-4"
      >
        <Link href="/" aria-label="Muroora Mart — home">
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
                  className={`font-mono text-micro uppercase tracking-label transition-colors duration-200 ${
                    active ? 'text-accent' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="flex items-center gap-1">
          <CartLink />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="min-h-11 min-w-11 p-2 md:hidden"
          >
            <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
            <span aria-hidden className="flex h-5 w-6 flex-col justify-between">
              <span
                className={`h-0.5 w-full bg-ink transition-transform duration-300 ${open ? 'translate-y-[9px] rotate-45' : ''}`}
              />
              <span
                className={`h-0.5 w-full bg-ink transition-opacity duration-200 ${open ? 'opacity-0' : ''}`}
              />
              <span
                className={`h-0.5 w-full bg-ink transition-transform duration-300 ${open ? '-translate-y-[9px] -rotate-45' : ''}`}
              />
            </span>
          </button>
        </div>
      </nav>

      <div
        id="mobile-nav"
        className={`grid overflow-hidden transition-[grid-template-rows] duration-300 md:hidden ${
          open ? 'grid-rows-[1fr] border-t border-rule' : 'grid-rows-[0fr]'
        }`}
      >
        <ul className="min-h-0">
          {LINKS.map((link) => (
            <li key={link.href} className="border-b border-rule last:border-0">
              <Link
                href={link.href}
                onClick={() => setOpen(false)}
                className="block px-gutter py-4 font-display text-h4 font-bold"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </header>
  )
}
