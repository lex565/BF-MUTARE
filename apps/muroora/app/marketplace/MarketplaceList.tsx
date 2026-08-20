'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useMemo, useState } from 'react'

import type { PublicBusiness, MarketplaceProduct } from '@/lib/services/marketplace'
import { ProductPhoto } from '@/app/components/marketplace/ProductPhoto'
import { productPath } from '@/lib/musuwo-urls'

/**
 * The Musuwo directory: every approved business, and what they are selling.
 *
 * THIS REPLACED A PREVIEW. What was here rendered nine invented businesses from
 * an array at the top of the file - a bookshop, a boarding house, a tutor -
 * with prices and areas, none of which existed. It looked exactly like a
 * working marketplace, which is the problem: a customer could have searched it,
 * found "Mutare Book Centre", and gone looking for a shop that was never real.
 *
 * Everything below comes from the database and nothing is drawn unless a
 * person approved it. When there is nothing, it says so.
 *
 * Filtering is in the browser rather than the server because the whole
 * directory is small enough to send at once and will be for a long while. When
 * it stops being small this becomes a server query with a URL parameter, and
 * the change is contained here.
 */

const KINDS = [
  ['ALL', 'Everything'],
  ['RETAIL', 'Shops'],
  ['FOOD', 'Food'],
  ['ACCOMMODATION', 'Accommodation'],
  ['SERVICE', 'Services'],
  ['EDUCATION', 'Tutors'],
  ['BEAUTY', 'Beauty'],
  ['AUTOMOTIVE', 'Motoring'],
  ['HOME_SERVICES', 'Home'],
  ['OTHER', 'Other'],
] as const

/**
 * The verification mark.
 *
 * The wording is doing real work. "Verified" alone invites a customer to read
 * it as "good", so the title attribute and the legend under the list both say
 * what was actually checked: a licence was seen. It is a statement about
 * identity, not about quality, and the badge should never grow into a rating.
 */
function VerifiedMark() {
  return (
    <span
      title="Musuwo has seen this business's trading licence. It says the business is registered, not that it is good."
      className="inline-flex items-center gap-1 rounded-pill bg-support/10 px-2 py-0.5 font-mono text-micro font-bold uppercase tracking-label text-support"
    >
      <svg viewBox="0 0 16 16" aria-hidden className="size-3 fill-current">
        <path d="M8 0 9.9 1.4 12.2 1.1 13 3.3 15 4.4 14.6 6.7 16 8.5 14.6 10.3 15 12.6 13 13.7 12.2 15.9 9.9 15.6 8 17 6.1 15.6 3.8 15.9 3 13.7 1 12.6 1.4 10.3 0 8.5 1.4 6.7 1 4.4 3 3.3 3.8 1.1 6.1 1.4Z" />
        <path d="m6.9 11.4-3-3 1.3-1.3 1.7 1.7 4-4L12.2 6Z" className="fill-paper" />
      </svg>
      Verified
    </span>
  )
}

/**
 * The merchant behind a product, on a card.
 *
 * Section 3: the business must stay identifiable on every product. The logo is
 * drawn when the merchant has uploaded one and the initial stands in when they
 * have not, which today is all of them - so the row never collapses and never
 * shows a broken image.
 *
 * NOT A LINK. It sits inside the product card's own <a>, and nesting an anchor
 * inside an anchor is invalid HTML that browsers resolve unpredictably. The
 * merchant's storefront is one tap away from the product page, which is where
 * the brief's merchant-click behaviour lives.
 */
function MerchantLine({ merchant }: { merchant: MarketplaceProduct['merchant'] }) {
  return (
    <span className="mt-3 flex items-center gap-2 text-small">
      <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper-sunk">
        {merchant.logoUrl ? (
          <Image
            src={merchant.logoUrl}
            alt=""
            width={24}
            height={24}
            className="size-6 object-contain"
          />
        ) : (
          <span aria-hidden className="font-mono text-[0.6rem] font-bold text-ink-faint">
            {merchant.name.charAt(0).toUpperCase()}
          </span>
        )}
      </span>
      <span className="min-w-0 truncate text-ink-soft">{merchant.name}</span>
      {merchant.verified && <VerifiedMark />}
    </span>
  )
}

function BusinessCard({ business }: { business: PublicBusiness }) {
  const href = business.storefrontUrl ?? `/stores/${business.slug}`
  return (
    <Link
      href={href}
      className="group flex flex-col border border-rule bg-paper p-6 transition-colors hover:border-support"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-14 shrink-0 items-center justify-center bg-paper-sunk">
          {/* logoUrl, not logoPath. The column stores a bucket path and this
              was passing it straight to next/image as a src, which can only
              ever produce a broken image. */}
          {business.logoUrl ? (
            <Image
              src={business.logoUrl}
              alt=""
              width={56}
              height={56}
              className="size-14 object-contain"
            />
          ) : (
            <span aria-hidden className="text-h3 text-ink-faint">
              {business.name.charAt(0)}
            </span>
          )}
        </div>
        {business.isFounding && (
          <span className="chip chip-live h-fit">Founding</span>
        )}
      </div>

      <h3 className="mt-5 text-h3 group-hover:text-support">{business.name}</h3>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {business.verified && <VerifiedMark />}
        <span className="font-mono text-micro uppercase tracking-label text-ink-faint">
          {business.city}
        </span>
      </div>

      {business.summary && (
        <p className="mt-3 text-small text-ink-soft">{business.summary}</p>
      )}

      <span className="mt-auto pt-5 font-mono text-micro uppercase tracking-label text-support">
        Visit →
      </span>
    </Link>
  )
}

function ProductCard({ product }: { product: MarketplaceProduct }) {
  return (
    <Link
      /**
       * INTO THE MERCHANT'S SHOP, NOT A GENERIC PRODUCT PAGE.
       *
       * This was `/product/{slug}`, which is Muroora Mart's own shop route and
       * knows only Muroora's catalogue. For every other merchant it answered
       * "Product not found", drawn in Muroora Mart's branding, on the Musuwo
       * domain. The first real product any outside merchant published - Cotton
       * pants from The Pant and Perfume Shop - was unreachable from the
       * marketplace that was listing it.
       *
       * The route below already existed and already worked. Nothing linked to
       * it. It also carries the merchant slug, so the customer arrives knowing
       * whose shop they are in, which is the point of section 5.
       */
      href={productPath(product.merchant.slug, product.slug)}
      className="group flex flex-col border border-rule bg-paper transition-colors hover:border-support"
    >
      <ProductPhoto src={product.imageUrl} alt={product.name} />
      <div className="flex flex-1 flex-col p-5">
      <h3 className="text-body font-bold group-hover:text-support">
        {product.name}
      </h3>
      {product.unitSize && (
        <p className="mt-1 text-small text-ink-faint">{product.unitSize}</p>
      )}

      {/* WHO IS SELLING IT. A marketplace listing without a named seller is
          how a customer ends up not knowing who they bought from. */}
      <MerchantLine merchant={product.merchant} />

      <p className="mt-4 text-h3 text-support">
        ${product.price.decimal}
      </p>
      </div>
    </Link>
  )
}

export function MarketplaceList({
  businesses,
  products,
  initialQuery = '',
}: {
  businesses: PublicBusiness[]
  products: MarketplaceProduct[]
  initialQuery?: string
}) {
  const [query, setQuery] = useState(initialQuery)
  const [kind, setKind] = useState<string>('ALL')

  const term = query.trim().toLowerCase()

  const shownBusinesses = useMemo(
    () =>
      businesses.filter(
        (b) =>
          (kind === 'ALL' || b.kind === kind) &&
          (term === '' ||
            b.name.toLowerCase().includes(term) ||
            (b.summary ?? '').toLowerCase().includes(term) ||
            b.city.toLowerCase().includes(term)),
      ),
    [businesses, kind, term],
  )

  const shownProducts = useMemo(
    () =>
      term === ''
        ? products
        : products.filter(
            (p) =>
              p.name.toLowerCase().includes(term) ||
              p.merchant.name.toLowerCase().includes(term),
          ),
    [products, term],
  )

  // Only the categories somebody actually trades in. Nine tabs of which seven
  // are permanently empty tells a customer the marketplace is empty.
  const availableKinds = KINDS.filter(
    ([value]) => value === 'ALL' || businesses.some((b) => b.kind === value),
  )

  return (
    <main>
      {/*
        PRODUCT-FIRST, NOT A DIRECTORY.

        This page used to open with "Local businesses you can find again",
        a paragraph about the merchant review process, and then a grid of
        business cards headed "3 businesses" - with the actual products below
        the fold under "Products across Musuwo". A customer arriving to shop
        was shown a register of companies and asked to pick one.

        The hierarchy is now hero, search, filters, products. Businesses have
        not gone anywhere: every product card names and links to its merchant,
        the storefronts are unchanged, and searching a merchant's name still
        surfaces that merchant. What has gone is the permanent block of
        business cards standing between somebody and the thing they came for.
      */}
      <section className="border-b border-rule bg-paper-sunk">
        <div className="mx-auto max-w-[86rem] px-gutter py-12">
          <h1 className="max-w-[16ch] text-mega leading-[.95]">
            Everything local, in one place.
          </h1>
          <p className="mt-5 max-w-2xl text-lead text-ink-soft">
            Discover products and services from local businesses across
            Zimbabwe.
          </p>

          <label className="mt-8 block">
            <span className="sr-only">Search products, businesses or areas</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-h-16 w-full border border-rule bg-paper px-6 text-lead focus:border-accent focus:outline-none"
              placeholder="Search products, businesses or areas"
              type="search"
            />
          </label>

          {availableKinds.length > 1 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {availableKinds.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setKind(value)}
                  aria-pressed={kind === value}
                  className={`chip transition-colors ${
                    kind === value ? 'border-support bg-support text-white' : ''
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-[86rem] px-gutter py-section">
        {/* Products first, always. */}
        {shownProducts.length > 0 ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <h2 className="text-h2">
                {term ? 'Matching products' : 'Products across Musuwo'}
              </h2>
              <Link
                href="/marketplace/apply"
                className="font-mono text-micro uppercase tracking-label text-support transition-colors hover:text-accent"
              >
                Sell on Musuwo →
              </Link>
            </div>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {shownProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </>
        ) : (
          <div className="max-w-measure border-l-4 border-accent bg-paper-sunk px-6 py-8">
            <h2 className="text-h3">
              {term ? 'Nothing matches that.' : 'No products are listed yet.'}
            </h2>
            <p className="mt-3 text-ink-soft">
              {term
                ? 'Try a different word, or browse everything.'
                : 'Musuwo is new. Products appear once an approved business publishes them, so this page shows nothing rather than examples that do not exist.'}
            </p>
            <Link
              href="/marketplace/apply"
              className="mt-6 inline-block bg-accent px-7 py-4 font-mono text-small font-bold uppercase tracking-label text-white transition-colors hover:bg-accent-deep"
            >
              Apply to list your business
            </Link>
          </div>
        )}

        {/*
          MERCHANTS APPEAR WHEN SOMEBODY LOOKS FOR ONE.

          Section 5 of the brief: intentional merchant search should still
          find a merchant; a permanent directory above the catalogue should
          not. So this block is rendered only while there is a search term
          that matches a business. Typing "The Pant and Perfume Shop" finds
          the shop; opening the page does not present a register of companies.
        */}
        {term !== '' && shownBusinesses.length > 0 && (
          <div className="mt-16">
            <h2 className="text-h2">
              {shownBusinesses.length === 1
                ? 'Matching business'
                : 'Matching businesses'}
            </h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {shownBusinesses.map((b) => (
                <BusinessCard key={b.publicId} business={b} />
              ))}
            </div>
          </div>
        )}

        {/*
          What "Verified" means, said once, in words - moved off the hero and
          down here beside the badges it explains. Section 8: the trust idea is
          worth keeping and must not dominate the shopping experience, and it
          must never read as Musuwo guaranteeing anybody.
        */}
        <p className="mt-16 max-w-measure border-t border-rule pt-6 text-small text-ink-faint">
          <strong className="text-ink-soft">Verified</strong> means Musuwo has
          seen that business&rsquo;s trading licence. It tells you the business
          is registered and can be traced. It is not a review, and it is not a
          judgement about how good they are.
        </p>
      </section>
    </main>
  )
}
