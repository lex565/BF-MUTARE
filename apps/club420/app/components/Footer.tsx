import Link from 'next/link'
import { BRANDS, PARENT, brandHref, parentHref } from '@pineberry/ui'
import { SITE, LEGAL } from '@/app/data/site'
import { Wordmark } from '@/app/components/Nav'

export function Footer() {
  const siblings = BRANDS.filter((brand) => brand.slug !== 'club-420')

  return (
    <footer className="border-t border-rule">
      {/* The legal band. It runs above the ordinary footer on every page, not
          buried in a terms link, because it is the client's own stated
          position and the thing a licensing officer would look for. */}
      <div className="border-b border-rule bg-paper-sunk">
        <div className="mx-auto max-w-[86rem] px-gutter py-8">
          <p className="stamp">{SITE.minimumAge}+ only</p>
          <p className="mt-5 max-w-[75ch] text-small leading-relaxed text-ink-soft">
            {LEGAL.licensed} {LEGAL.notCannabis} {LEGAL.responsible}
          </p>
        </div>
      </div>

      <div className="mx-auto grid max-w-[86rem] gap-12 px-gutter py-16 md:grid-cols-12">
        <div className="md:col-span-5">
          <Link href="/" className="flex items-baseline gap-3">
            <Wordmark />
            <span className="font-mono text-micro uppercase tracking-label text-ink-faint">
              Liquor Store
            </span>
          </Link>
          <p className="mt-5 max-w-[32ch] font-display text-h3 text-accent">
            {SITE.tagline}
          </p>
        </div>

        <div className="md:col-span-3">
          <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
            Find us
          </p>
          <p className="mt-4 text-ink-soft">
            {SITE.city}, {SITE.country}
          </p>
          <p className="mt-4 max-w-[30ch] text-small text-ink-faint">
            Street address and phone number still to be confirmed.
          </p>
        </div>

        <div className="md:col-span-4 md:text-right">
          <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
            Part of {PARENT.name}
          </p>
          <a
            href={parentHref()}
            className="mt-3 block font-mono text-micro uppercase tracking-label text-accent transition-colors hover:text-ink"
          >
            {PARENT.name} ↗
          </a>

          <ul className="mt-6 space-y-2">
            {siblings.map((brand) => (
              <li key={brand.slug}>
                <a
                  href={brandHref(brand)}
                  className="inline-flex items-center gap-2 font-mono text-micro uppercase tracking-label text-ink-faint transition-colors hover:text-ink md:flex-row-reverse"
                >
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: brand.palette.accent }}
                  />
                  {brand.name}
                </a>
              </li>
            ))}
          </ul>

          <p className="mt-8 font-mono text-micro text-ink-faint">
            © {new Date().getFullYear()} {SITE.fullName}
          </p>
        </div>
      </div>
    </footer>
  )
}
