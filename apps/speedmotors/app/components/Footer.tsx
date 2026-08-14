import Link from 'next/link'
import { BRANDS, PARENT, brandHref, parentHref } from '@pineberry/ui'
import { SITE, yearsTrading } from '@/app/data/site'
import { Logo } from '@/app/components/Nav'

export function Footer() {
  const siblings = BRANDS.filter((brand) => brand.slug !== 'speed-motors')

  return (
    <footer className="border-t border-rule bg-paper-sunk">
      <div className="mx-auto grid max-w-[86rem] gap-12 px-gutter py-16 md:grid-cols-12">
        <div className="md:col-span-5">
          <Link href="/">
            <Logo className="h-8" />
          </Link>
          <p className="mt-5 max-w-[34ch] text-ink-soft">
            {SITE.fullName}. Engine, gearbox and suspension work in{' '}
            {SITE.country} for {yearsTrading()} years.
          </p>
        </div>

        <div className="md:col-span-3">
          <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
            Find us
          </p>
          <p className="mt-4 text-ink-soft">
            {SITE.city ?? SITE.country}
          </p>
          <p className="mt-4 max-w-[30ch] text-small text-ink-faint">
            Workshop address and phone number still to be confirmed.
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
