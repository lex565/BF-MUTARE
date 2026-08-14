import Link from 'next/link'
import { Masthead } from '@/app/components/Masthead'
import { Statement } from '@/app/components/Statement'
import { Companies } from '@/app/components/Companies'
import { Approach } from '@/app/components/Approach'
import { Colophon } from '@/app/components/Colophon'

/**
 * The home page.
 *
 * The site is separated into pages now — /companies, /approach, /contact — but
 * home still carries a shortened pass of each, so a first-time visitor gets the
 * whole picture without navigating, and anyone who wants depth has somewhere to
 * go. Home ends and hands off; it is not the entire site on one scroll.
 */
export default function Home() {
  return (
    <>
      <Masthead />
      <main>
        <Statement />
        <Companies />
        <Approach />

        <section className="border-b border-rule">
          <div className="mx-auto max-w-[80rem] px-gutter py-section">
            <div className="flex flex-wrap items-end justify-between gap-8">
              <h2 className="max-w-[18ch] text-h1">
                Talk to the business, not the holding company
              </h2>
              <Link
                href="/contact"
                className="group inline-flex items-center gap-3 bg-accent px-8 py-4 font-mono text-small font-bold uppercase tracking-label text-paper transition-colors hover:bg-accent-deep"
              >
                Who to talk to
                <span
                  aria-hidden
                  className="transition-transform duration-300 group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Colophon />
    </>
  )
}
