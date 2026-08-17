import Link from 'next/link'
import { MusuwoLogo } from '@/app/components/MusuwoLogo'

export function Footer() {
  return (
    <footer className="border-t border-rule bg-paper-sunk">
      <div className="mx-auto grid max-w-[86rem] gap-12 px-gutter py-16 md:grid-cols-12">
        <div className="md:col-span-5">
          <Link href="/">
            <MusuwoLogo />
          </Link>
          <p className="mt-5 max-w-[38ch] text-ink-soft">Your gateway to local businesses, products, food, accommodation and services. Muroora Mart is the founding merchant.</p>
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
            Independent Zimbabwean marketplace
          </p>
          <p className="mt-3 text-small text-ink-soft">
            Built for local businesses and customers across Zimbabwe.
          </p>

          <p className="mt-8 font-mono text-micro text-ink-faint">
            © {new Date().getFullYear()} Musuwo
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
