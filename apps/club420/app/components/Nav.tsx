'use client'

import Image from 'next/image'
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
 * The crest.
 *
 * This replaces the type-set `4:20` stand-in that stood here while the logo
 * described in the brand document had not been drawn. It now has been.
 *
 * The artwork already contains "LIQUOR STORE" and "MUTARE", so nothing is set
 * beside it — repeating either in HTML next to the mark would say the same
 * thing twice. The accessible name lives on the alt text instead.
 *
 * The file arrived with a correct alpha channel (45% of it transparent, 168
 * stray white pixels), so nothing was knocked out — only trimmed to its
 * bounding box and resized.
 */
/* Sized generously on purpose. This is a detailed crest — a mountain range,
   a glass, two lines of lettering — and at the 32-40px a wordmark would take
   it turns to mush. It carries the site's whole identity, so it gets the
   room. */
export function Wordmark({ className = 'h-16' }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="420 Liquor Store, Mutare"
      width={512}
      height={489}
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
        <Link href="/" aria-label="420 Liquor Store — home">
          <Wordmark />
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
