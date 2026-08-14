'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const LINKS = [
  { href: '/story', label: 'The story' },
  { href: '/range', label: 'The range' },
  { href: '/experiences', label: 'Experiences' },
  { href: '/contact', label: 'Visit' },
]

/**
 * Wordmark.
 *
 * The brand document describes a logo — a minimalist clock frozen at 4:20,
 * stylised into a bottle silhouette — but that artwork does not exist yet, and
 * no file was supplied. Rather than invent a mark, the number is set as type
 * with the clock colon carried in the accent, which is honest and will not
 * fight the real logo when it arrives.
 */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`font-display text-h3 leading-none tracking-wide ${className}`}
    >
      4<span className="text-accent">:</span>20
    </span>
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
        <Link
          href="/"
          aria-label="420 Liquor Store — home"
          className="flex items-baseline gap-3"
        >
          <Wordmark />
          <span className="hidden font-mono text-micro uppercase tracking-label text-ink-faint sm:inline">
            Liquor Store
          </span>
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
              className={`h-px w-full bg-ink transition-transform duration-300 ${open ? 'translate-y-[9px] rotate-45' : ''}`}
            />
            <span
              className={`h-px w-full bg-ink transition-opacity duration-200 ${open ? 'opacity-0' : ''}`}
            />
            <span
              className={`h-px w-full bg-ink transition-transform duration-300 ${open ? '-translate-y-[9px] -rotate-45' : ''}`}
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
                className="block px-gutter py-4 font-display text-h3"
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
