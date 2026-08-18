import Link from 'next/link'
import { MusuwoLogo } from '@/app/components/MusuwoLogo'
import { Logo } from '@/app/components/Logo'
import { brand, isMuroora } from '@/lib/brand'

/**
 * Where the other site lives.
 *
 * Absent rather than guessed: if the variable is not set the link simply does
 * not render, which is better than shipping a link to a domain that may not
 * exist yet.
 */
const MUSUWO_URL = process.env.NEXT_PUBLIC_MUSUWO_URL

export function Footer() {
  return (
    <footer className="border-t border-rule bg-paper-sunk">
      <div className="mx-auto grid max-w-[86rem] gap-12 px-gutter py-16 md:grid-cols-12">
        <div className="md:col-span-5">
          <Link href="/">
            {isMuroora ? <Logo className="h-11" /> : <MusuwoLogo />}
          </Link>
          <p className="mt-5 max-w-[38ch] text-ink-soft">{brand.description}</p>

          {/* The one link between the two sites, and it goes in the footer
              rather than the navigation. Muroora Mart is a shop; a customer
              buying mealie meal does not need the marketplace put in front of
              them, but a merchant looking for it should be able to find it. */}
          {isMuroora && MUSUWO_URL && (
            <a
              href={MUSUWO_URL}
              className="mt-6 inline-block font-mono text-micro uppercase tracking-label text-support transition-colors hover:text-accent"
            >
              Part of Musuwo &rarr;
            </a>
          )}
        </div>

        <div className="md:col-span-3">
          <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
            Find us
          </p>
          <p className="mt-4 text-ink-soft">
            Mutare, Zimbabwe
          </p>
          {/* Contact details are genuinely unknown - the company profile gives
              the city and nothing more. Saying so beats inventing a number. */}
          <p className="mt-4 max-w-[30ch] text-small text-ink-faint">
            Phone and email are still to be confirmed.
          </p>
        </div>

        {/* Links to the parent only. The sister companies are listed on
            Pineberry's own site, which is the page whose job that is - see
            packages/ui/src/GroupBar.tsx. */}
        <div className="md:col-span-4 md:text-right">
          <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
            {/* Musuwo is named ONCE on this site, in the "Part of Musuwo"
                link on the left. Saying it twice in one footer starts to make
                a grocer's website look like somebody else's shopfront, which
                is the thing being avoided. */}
            {isMuroora
              ? 'Groceries and household goods · Mutare'
              : 'Independent Zimbabwean marketplace'}
          </p>
          <p className="mt-3 text-small text-ink-soft">
            {isMuroora
              ? 'Serving Mutare since 2025.'
              : 'Built for local businesses and customers across Zimbabwe.'}
          </p>

          <p className="mt-8 font-mono text-micro text-ink-faint">
            © {new Date().getFullYear()} {brand.name}
          </p>
          <Link
            href="/team-access"
            className="mt-3 inline-block font-mono text-[0.62rem] uppercase tracking-label text-ink-faint transition-colors hover:text-ink-soft"
          >
            Team access
          </Link>
        </div>
      </div>
    </footer>
  )
}
