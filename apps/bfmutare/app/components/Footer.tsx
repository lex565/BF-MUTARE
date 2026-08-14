import Link from 'next/link'
import { SITE, mapLink } from '@/app/data/site'
import { Logo } from '@/app/components/Logo'
import { Social } from '@/app/components/Social'

export function Footer() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto grid max-w-[86rem] gap-12 px-gutter py-16 md:grid-cols-12">
        <div className="md:col-span-5">
          <Link href="/">
            <Logo />
          </Link>
          <p className="mt-4 max-w-[34ch] text-small text-ink-faint">
            {SITE.tagline}
          </p>
          <Social className="mt-6" />
        </div>

        {/* Address links out to the map rather than embedding one. A map
            library is ~40KB of JavaScript to show a pin that Google Maps
            already renders better, and on a phone the native app opens. */}
        <div className="md:col-span-4">
          <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
            Find us
          </p>
          <a
            href={mapLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 block max-w-[30ch] text-small text-ink-soft transition-colors hover:text-accent"
          >
            {SITE.address.street}
            <br />
            {SITE.address.city}, {SITE.address.country}
            <span className="ml-1 text-ink-faint">↗</span>
          </a>
          <a
            href={`tel:+${SITE.whatsapp}`}
            className="mt-4 block font-mono text-small text-ink-soft transition-colors hover:text-accent"
          >
            {SITE.phoneDisplay}
          </a>
          <a
            href={`mailto:${SITE.email}`}
            className="mt-1 block font-mono text-small text-ink-soft transition-colors hover:text-accent"
          >
            {SITE.email}
          </a>
        </div>

        <div className="flex flex-col gap-3 md:col-span-3 md:items-end">
          <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
            A {SITE.parent} company
          </p>
          <a
            href="https://pineberryholdings.com"
            className="font-mono text-micro uppercase tracking-label text-ink-soft transition-colors hover:text-accent"
          >
            pineberryholdings.com ↗
          </a>
          <p className="mt-2 font-mono text-micro text-ink-faint">
            © {new Date().getFullYear()} {SITE.legalName}
          </p>
        </div>
      </div>
    </footer>
  )
}
