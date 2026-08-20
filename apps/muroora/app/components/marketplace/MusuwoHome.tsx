import Image from 'next/image'
import Link from 'next/link'

import { MusuwoLogo } from '@/app/components/MusuwoLogo'
import { ForYouFeed } from '@/app/components/marketplace/ForYouFeed'
import { rankForYou } from '@/lib/services/for-you'
import { discoverySession } from '@/lib/services/discovery-session'
import { currentUser } from '@/lib/auth'

/**
 * The Musuwo homepage, which is now a product feed.
 *
 * WHAT THIS REPLACED, AND WHY IT HAD TO GO
 *
 * The previous homepage was a client component with a constant array in it
 * holding exactly one business - Muroora Mart - with a hard-coded "4.5 Musuwo
 * Business Score" that was computed from nothing, and a caption promising that
 * "new approved businesses will join this showcase automatically". They did
 * not. By the time this was written the platform had three approved merchants
 * and two of them were invisible on the front page of their own marketplace,
 * including one approved that morning.
 *
 * Sections 2 and 3 of the brief also change what the front page is *for*.
 * Businesses were the discovery object and products were buried inside them.
 * Now products are what a customer browses and the business is what they
 * discover behind the product, which is how somebody shops: they want cooking
 * oil, and they find out Muroora Mart sells it.
 *
 * Businesses have not disappeared. Every card names its merchant, the merchant
 * name opens the storefront, and the directory is still one click away.
 *
 * WHY THE RANKING RUNS ON THE SERVER
 *
 * Section 40: the client receives an ordered list and never the inputs that
 * ordered it. There is no score in the payload a browser can edit, and no
 * amount of tampering in the network tab changes what anybody else is shown.
 */

const CATEGORIES = [
  ['', 'Everything'],
  ['RETAIL', 'Shops'],
  ['FOOD', 'Food'],
  ['ACCOMMODATION', 'Stay'],
  ['SERVICE', 'Services'],
  ['EDUCATION', 'Tutors'],
  ['BEAUTY', 'Beauty'],
  ['AUTOMOTIVE', 'Motoring'],
  ['HOME_SERVICES', 'Home'],
] as const

export async function MusuwoHome({ kind }: { kind?: string }) {
  const [{ sessionId }, user] = await Promise.all([
    discoverySession(),
    currentUser(),
  ])

  const products = await rankForYou({
    sessionId,
    userId: user?.id ?? null,
    kind: kind || null,
    limit: 48,
  })

  return (
    <div className="min-h-dvh bg-paper">
      <nav className="sticky top-0 z-50 border-b border-rule bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[86rem] flex-wrap items-center gap-4 px-gutter py-3">
          <Link href="/" aria-label="Musuwo home" className="shrink-0">
            <MusuwoLogo />
          </Link>

          <form
            action="/marketplace"
            className="order-3 flex min-h-11 w-full flex-1 items-center gap-3 rounded-md bg-paper-sunk px-4 sm:order-none sm:w-auto"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-5 shrink-0 text-ink-faint"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <label className="sr-only" htmlFor="musuwo-search">
              Search Musuwo
            </label>
            <input
              id="musuwo-search"
              name="q"
              type="search"
              placeholder="Search Musuwo"
              className="min-w-0 flex-1 bg-transparent text-small outline-none"
            />
          </form>

          <Link
            href="/access"
            className="ml-auto inline-flex min-h-11 shrink-0 items-center gap-2 text-small font-medium text-support hover:text-accent"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="12" cy="7" r="3.5" />
              <path d="M5 21c.6-4.6 2.9-7 7-7s6.4 2.4 7 7" />
            </svg>
            <span className="hidden sm:inline">{user ? 'Account' : 'Log in'}</span>
          </Link>
        </div>

        {/* Category shortcuts, which section 3 keeps near the top. Plain links
            rather than client state so a chosen category is a real URL that
            can be shared, bookmarked and returned to by pressing back. */}
        <div className="border-t border-rule-soft">
          <div className="mx-auto flex max-w-[86rem] gap-1 overflow-x-auto px-gutter py-2">
            {CATEGORIES.map(([value, label]) => {
              const active = (kind ?? '') === value
              return (
                <Link
                  key={label}
                  href={value ? `/?kind=${value}` : '/'}
                  className={`shrink-0 rounded-pill px-4 py-2 text-small font-medium transition-colors ${
                    active
                      ? 'bg-support text-white'
                      : 'text-support hover:bg-paper-sunk'
                  }`}
                >
                  {label}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-[86rem] px-gutter py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-micro font-bold uppercase tracking-[0.3em] text-accent">
              For you
            </p>
            <h1 className="mt-2 text-h1 text-support">
              Local businesses, one doorway.
            </h1>
          </div>
          <Link
            href="/marketplace"
            className="font-mono text-micro font-bold uppercase tracking-label text-accent hover:text-accent-deep"
          >
            Browse businesses →
          </Link>
        </div>

        <ForYouFeed
          products={products}
          feedKey={`home:${kind ?? 'all'}`}
          surface={kind ? 'CATEGORY' : 'FOR_YOU'}
        />
      </main>

      <footer className="mt-12 border-t border-rule bg-paper-sunk px-gutter py-8">
        <div className="mx-auto flex max-w-[86rem] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="/musuwo-logo.png"
              alt=""
              width={36}
              height={36}
              className="size-9 object-contain"
            />
            <div>
              <p className="text-small text-ink-faint">
                Musuwo · Zimbabwe&rsquo;s local business gateway
              </p>
              {/* One address in the footer rather than all three. A footer is
                  glanced at, not read; the full list with what each is for is
                  on /contact. */}
              <a
                href="mailto:hello@musuwo.online"
                className="text-small text-support hover:text-accent"
              >
                hello@musuwo.online
              </a>
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <Link
              href="/marketplace/apply"
              className="font-mono text-[0.62rem] uppercase tracking-label text-ink-faint hover:text-support"
            >
              Sell on Musuwo
            </Link>
            <Link
              href="/riders"
              className="font-mono text-[0.62rem] uppercase tracking-label text-ink-faint hover:text-support"
            >
              Deliver with Musuwo
            </Link>
            <Link
              href="/contact"
              className="font-mono text-[0.62rem] uppercase tracking-label text-ink-faint hover:text-support"
            >
              Contact us
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
