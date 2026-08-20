import Image from 'next/image'
import Link from 'next/link'

import type { PublicBusiness } from '@/lib/services/marketplace'
import { storePath } from '@/lib/musuwo-urls'

/**
 * The banner that tells a customer whose shop they are standing in.
 *
 * WHY IT MATTERS MORE THAN IT LOOKS
 *
 * Most people arriving at a merchant page on Musuwo did not browse there. They
 * followed a link somebody sent them on WhatsApp. They have no context at all,
 * and the first question they are silently asking is "who am I buying from".
 * Before this, the answer was a line of body text.
 *
 * EVERYTHING HERE IS THE MERCHANT'S OWN DATA
 *
 * Nothing is hard-coded. No merchant name, no colour keyed to a particular
 * shop, no placeholder standing in for a real business. Where a merchant has
 * not uploaded a logo or a cover - which today is all three of them - the
 * fallback is built from their own name and category rather than from a stock
 * graphic, so an empty storefront reads as new rather than as broken.
 *
 * THE BADGE SAYS ONE THING
 *
 * "Musuwo checked this business's trading licence." Not that they are good,
 * not that they are recommended, not a rating. The title attribute says so in
 * words, because a tick on a shopping site is read as endorsement unless it is
 * explicitly told not to be.
 */

const KIND_LABELS: Record<string, string> = {
  RETAIL: 'Shop',
  FOOD: 'Food',
  ACCOMMODATION: 'Accommodation',
  SERVICE: 'Services',
  EDUCATION: 'Tutoring',
  BEAUTY: 'Beauty',
  AUTOMOTIVE: 'Motoring',
  HOME_SERVICES: 'Home services',
  OTHER: 'Business',
}

export function StoreHeader({
  business,
  /** Set on the storefront home, where the heading is the page's h1. */
  asHeading = false,
}: {
  business: PublicBusiness
  asHeading?: boolean
}) {
  const Name = asHeading ? 'h1' : 'p'

  return (
    <header className="border-b border-rule bg-white">
      {/* The cover. A tinted band derived from nothing but the page's own
          palette when there is no image, rather than a grey box with a broken
          icon in it. */}
      <div className="relative h-32 w-full overflow-hidden bg-gradient-to-r from-support to-accent-deep sm:h-44">
        {business.coverImageUrl && (
          <Image
            src={business.coverImageUrl}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        )}
      </div>

      <div className="mx-auto max-w-[86rem] px-gutter">
        <div className="flex flex-wrap items-end gap-5 pb-6">
          <div className="-mt-10 flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-4 border-white bg-paper-sunk shadow-sm sm:-mt-12 sm:size-24">
            {business.logoUrl ? (
              <Image
                src={business.logoUrl}
                alt=""
                width={96}
                height={96}
                className="size-full object-contain"
              />
            ) : (
              /* Their initials, from their own name. */
              <span className="font-mono text-h3 font-bold text-support">
                {business.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((word) => word[0])
                  .join('')
                  .toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <Name className="text-h2 leading-tight text-support">
                <Link href={storePath(business.slug)} className="hover:text-accent">
                  {business.name}
                </Link>
              </Name>
              {business.verified && (
                <span
                  title="Musuwo has seen this business's trading licence. It says the business is registered, not that it is good."
                  className="inline-flex items-center gap-1 rounded-pill bg-support/10 px-2 py-0.5 font-mono text-micro font-bold uppercase tracking-label text-support"
                >
                  Verified
                </span>
              )}
              {business.isFounding && (
                <span className="rounded-pill bg-accent/10 px-2 py-0.5 font-mono text-micro font-bold uppercase tracking-label text-accent">
                  Founding business
                </span>
              )}
            </div>

            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-ink-faint">
              <span>{KIND_LABELS[business.kind] ?? KIND_LABELS.OTHER}</span>
              <span aria-hidden>·</span>
              <span>{business.city}</span>
              <span aria-hidden>·</span>
              <span className="font-mono text-micro">{business.publicId}</span>
            </p>

            {(business.tagline || business.summary) && (
              <p className="mt-2 max-w-prose text-ink-soft">
                {business.tagline ?? business.summary}
              </p>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
