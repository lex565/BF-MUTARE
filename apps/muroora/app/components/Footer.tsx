import Link from 'next/link'
import { BRANDS, PARENT, brandHref, parentHref } from '@pineberry/ui'
import { SITE } from '@/app/data/site'
import { Logo } from '@/app/components/Logo'

export function Footer() {
  const siblings = BRANDS.filter((brand) => brand.slug !== 'muroora-mart')

  return (
    <footer className="border-t border-rule bg-paper-sunk">
      <div className="mx-auto grid max-w-[86rem] gap-12 px-gutter py-16 md:grid-cols-12">
        <div className="md:col-span-5">
          <Link href="/">
            <Logo className="h-10" />
          </Link>
          <p className="mt-5 max-w-[38ch] text-ink-soft">{SITE.nameMeaning}</p>
        </div>

        <div className="md:col-span-3">
          <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
            Find us
          </p>
          <p className="mt-4 text-ink-soft">
            {SITE.city}, {SITE.country}
          </p>
          {/* Contact details are genuinely unknown — the company profile gives
              the city and nothing more. Saying so beats inventing a number. */}
          <p className="mt-4 max-w-[30ch] text-small text-ink-faint">
            Phone and email are still to be confirmed.
          </p>
        </div>

        {/* Every site in the group carries the full group list in its footer,
            not just a link home — see also GroupBar at the top of the page. */}
        <div className="md:col-span-4 md:text-right">
          <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
            Part of {PARENT.name}
          </p>
          <a
            href={parentHref()}
            className="mt-3 block font-mono text-micro uppercase tracking-label text-support transition-colors hover:text-accent"
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
            © {new Date().getFullYear()} {SITE.name}
          </p>
        </div>
      </div>
    </footer>
  )
}
