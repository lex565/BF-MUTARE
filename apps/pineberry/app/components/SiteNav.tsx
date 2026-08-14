'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/companies', label: 'Companies' },
  { href: '/approach', label: 'Approach' },
  { href: '/contact', label: 'Contact' },
]

/**
 * Nav for the inner pages.
 *
 * The home page does not use this — its masthead carries its own nav over the
 * video, because a solid bar above a full-bleed hero cuts the image in half.
 * Inner pages have no hero, so they get the ordinary sticky bar.
 */
export function SiteNav() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-paper/95 backdrop-blur-md">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-[80rem] flex-wrap items-center justify-between gap-4 px-gutter py-4"
      >
        <Link href="/" className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full bg-support"
          />
          <span className="font-display text-lead">Pineberry Holdings</span>
        </Link>

        <ul className="flex flex-wrap items-center gap-x-7 gap-y-2">
          {LINKS.map((link) => {
            const active = pathname.startsWith(link.href)
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`font-mono text-micro uppercase tracking-label transition-colors ${
                    active ? 'text-accent' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </header>
  )
}
