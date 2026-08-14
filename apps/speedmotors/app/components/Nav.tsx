'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const LINKS = [
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
]

/**
 * The logo is the company's own artwork and is pure black, which is why this
 * site runs on a light ground — see globals.css. It arrived with a correct
 * alpha channel already, so it was only trimmed to its bounding box.
 */
export function Logo({ className = 'h-7' }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="Speed Motor Engineering"
      width={2646}
      height={355}
      priority
      className={`w-auto ${className}`}
    />
  )
}

export function Nav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-paper/95 backdrop-blur-md">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-[86rem] items-center justify-between gap-6 px-gutter py-4"
      >
        <Link href="/" aria-label="Speed Motor Engineering — home">
          <Logo />
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => {
            const active = pathname.startsWith(link.href)
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
                className="block px-gutter py-4 font-display text-h4 uppercase"
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
