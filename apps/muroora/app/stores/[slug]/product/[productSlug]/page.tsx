import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { currentUser } from '@/lib/auth'
import {
  getMarketplaceProduct,
  getPublicBusiness,
  listMarketplaceProducts,
  recordMarketplaceProductView,
} from '@/lib/services/marketplace'
import { recordEvent } from '@/lib/services/discovery-events'
import { discoverySession } from '@/lib/services/discovery-session'
import { productUrl, storePath, productPath } from '@/lib/musuwo-urls'
import { ProductPhoto } from '@/app/components/marketplace/ProductPhoto'
import { ShareProduct } from '@/app/components/marketplace/ShareProduct'
import { AddToBasket } from '@/app/components/marketplace/AddToBasket'
import { StoreHeader } from '@/app/components/marketplace/StoreHeader'

/**
 * A product, inside the shop that sells it. The canonical address.
 *
 * WHY THIS ROUTE EXISTS RATHER THAN THE OLD ONE
 *
 * See lib/musuwo-urls.ts. The short version: a product had three addresses and
 * the one the marketplace linked to was Muroora Mart's private shop route,
 * which answered "Product not found" in Muroora's branding for every other
 * merchant's stock. `/marketplace/product/...` now redirects here permanently.
 *
 * WHAT A SHARED LINK HAS TO DO, AND WHAT IT MUST NOT
 *
 * Anybody may open this page. There is no registration wall, because a wall in
 * front of a shared product means the person who shared it sent their friend a
 * sign-up form. Authentication is required to buy, not to look.
 *
 * The public payload is the public payload: name, price, photo, description,
 * merchant name, logo, whether a licence was checked. It carries no contact
 * details the merchant did not deliberately publish, no analytics, no revenue,
 * and nothing about any other customer. That is enforced in
 * lib/services/marketplace.ts by selecting columns explicitly rather than
 * `select *`, which is what stops a schema change quietly publishing a private
 * one.
 *
 * A SHARED LINK DOES NOT BYPASS MODERATION. `getMarketplaceProduct` reads
 * through the same four conditions as the feed - active, not deleted,
 * published to Musuwo, and the business publicly visible - so suspending a
 * merchant takes their shared links down with them, on the next request.
 */

export const dynamic = 'force-dynamic'

type Params = Promise<{ slug: string; productSlug: string }>

export async function generateMetadata({
  params,
}: {
  params: Params
}): Promise<Metadata> {
  const { slug, productSlug } = await params
  const product = await getMarketplaceProduct(slug, productSlug)

  if (!product) {
    return {
      title: 'This product is not available',
      // A product that has been withdrawn should stop being indexed. It should
      // still render a page for anybody holding the link, which is why this is
      // metadata rather than a 404.
      robots: { index: false, follow: true },
    }
  }

  const url = productUrl(slug, productSlug)
  /**
   * Two titles, on purpose.
   *
   * The root layout applies `template: '%s - Musuwo'`, so a page title ending
   * in "| Musuwo" renders as "... | Musuwo - Musuwo". The tab gets the short
   * form and lets the template add the brand; the Open Graph title carries the
   * brand itself, because a WhatsApp preview has no layout template and the
   * recipient needs to see where the link goes.
   */
  const pageTitle = `${product.name} | ${product.merchant.name}`
  const title = `${pageTitle} | Musuwo`
  const description = product.description
    ? `${product.description.slice(0, 150)} Available on Musuwo from ${product.merchant.name}.`
    : `Shop ${product.name} from ${product.merchant.name} on Musuwo.`

  return {
    title: pageTitle,
    description,
    // One canonical address, so a share from the old path and a share from the
    // new one are the same page to a search engine rather than two.
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      siteName: 'Musuwo',
      // The merchant's own photograph, absolute, straight from public storage.
      // Nothing is hard-coded: no product name, price, merchant or image
      // appears in this file as a literal.
      images: product.imageUrl
        ? [{ url: product.imageUrl, alt: product.name }]
        : undefined,
    },
    twitter: {
      card: product.imageUrl ? 'summary_large_image' : 'summary',
      title,
      description,
      images: product.imageUrl ? [product.imageUrl] : undefined,
    },
  }
}

export default async function StoreProductPage({ params }: { params: Params }) {
  const { slug, productSlug } = await params

  const [product, business] = await Promise.all([
    getMarketplaceProduct(slug, productSlug),
    getPublicBusiness(slug),
  ])

  // The merchant does not exist publicly at all - suspended, unapproved or
  // never real. That is a 404, because there is nothing to show and no shop to
  // send anybody to.
  if (!business) notFound()

  /**
   * The product is gone but the shop is not.
   *
   * Section: "For unavailable products, show a proper customer-facing
   * experience rather than an internal/server error." Somebody has followed a
   * link a friend sent them; telling them "404" and stopping is the worst
   * possible answer. They get the shop, an explanation, and what else is on
   * the shelf.
   */
  if (!product) {
    const others = (await listMarketplaceProducts())
      .filter((p) => p.merchant.slug === slug)
      .slice(0, 4)

    return (
      <main className="min-h-dvh bg-paper">
        <StoreHeader business={business} />
        <div className="mx-auto max-w-[72rem] px-gutter py-12">
          <div className="border border-rule bg-paper-sunk p-8">
            <h1 className="text-h2 text-support">
              This product is not available at the moment.
            </h1>
            <p className="mt-3 max-w-prose text-ink-soft">
              {business.name} may have sold out or taken it off the shelf. The
              shop is still open.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={storePath(slug)}
                className="rounded-full bg-support px-6 py-3 font-bold text-white"
              >
                Visit {business.name}
              </Link>
              <Link
                href="/"
                className="rounded-full border border-rule px-6 py-3 font-bold text-support"
              >
                Keep shopping
              </Link>
            </div>
          </div>

          {others.length > 0 && (
            <section className="mt-12">
              <h2 className="text-h3 text-support">Also from this shop</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {others.map((other) => (
                  <Link
                    key={other.id}
                    href={productPath(slug, other.slug)}
                    className="flex flex-col border border-rule bg-paper hover:border-support"
                  >
                    <ProductPhoto src={other.imageUrl} alt={other.name} />
                    <div className="p-4">
                      <h3 className="font-bold">{other.name}</h3>
                      <p className="mt-2 text-support">${other.price.decimal}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    )
  }

  const [{ sessionId }, user] = await Promise.all([
    discoverySession(),
    currentUser(),
  ])

  /**
   * A view, and a store visit that names the doorway.
   *
   * Two events, not one. The view says somebody opened this item; the store
   * visit says somebody entered this shop and records which product brought
   * them, which is the "store discovery generated" figure a merchant cares
   * about. Both go through the server-side recorder, so both are deduplicated
   * and both are marked excluded if it is the merchant looking at their own
   * listing.
   */
  await Promise.all([
    recordEvent({
      eventType: 'PRODUCT_VIEW',
      productId: product.id,
      surface: 'STOREFRONT',
      sessionId,
      userId: user?.id ?? null,
    }),
    recordEvent({
      eventType: 'STORE_VISIT',
      businessId: business.id,
      entryProductId: product.id,
      surface: 'STOREFRONT',
      sessionId,
      userId: user?.id ?? null,
    }),
    // The original per-account view table. Kept because listRecommendedProducts
    // still reads it and it is the only history that predates this work.
    user ? recordMarketplaceProductView(user.id, product.id) : Promise.resolve(),
  ])

  const url = productUrl(slug, productSlug)
  const others = (await listMarketplaceProducts())
    .filter((p) => p.merchant.slug === slug && p.id !== product.id)
    .slice(0, 4)

  /**
   * Structured data, so a shared link can render as a product rather than as a
   * bare link. Built entirely from the row - there is no literal price, name or
   * merchant in this file.
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description ?? undefined,
    image: product.imageUrl ?? undefined,
    sku: product.slug,
    brand: { '@type': 'Brand', name: product.merchant.name },
    offers: {
      '@type': 'Offer',
      url,
      price: product.price.decimal,
      priceCurrency: product.price.currency,
      availability: 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: product.merchant.name },
    },
  }

  return (
    <main className="min-h-dvh bg-paper">
      <script
        type="application/ld+json"
        // The payload is built above from database columns, not from anything
        // a visitor supplied, and JSON.stringify escapes the values.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <StoreHeader business={business} />

      <div className="mx-auto max-w-[72rem] px-gutter py-10">
        <nav aria-label="Breadcrumb" className="text-small text-ink-faint">
          <Link href="/" className="hover:text-support">
            Musuwo
          </Link>
          <span aria-hidden> / </span>
          <Link href={storePath(slug)} className="hover:text-support">
            {business.name}
          </Link>
          <span aria-hidden> / </span>
          <span className="text-support">{product.name}</span>
        </nav>

        <div className="mt-8 grid gap-10 md:grid-cols-2">
          <ProductPhoto src={product.imageUrl} alt={product.name} priority />

          <div>
            <Link
              href={storePath(slug)}
              className="font-mono text-micro uppercase tracking-label text-accent hover:text-accent-deep"
            >
              {product.merchant.name}
            </Link>
            <h1 className="mt-3 text-h1 text-support">{product.name}</h1>
            {product.unitSize && (
              <p className="mt-3 text-ink-soft">{product.unitSize}</p>
            )}
            <p className="mt-5 text-h2 text-support">${product.price.decimal}</p>
            {product.description && (
              <p className="mt-6 max-w-prose text-lead text-ink-soft">
                {product.description}
              </p>
            )}

            {/* The shopping action comes first and WhatsApp does not appear
                here at all. Contacting the merchant is a secondary thing on a
                secondary row below, per the brief: WhatsApp is a way to share
                a Musuwo link, not Musuwo's checkout. */}
            <div className="mt-8">
              <AddToBasket
                productId={product.id}
                merchantName={product.merchant.name}
              />
            </div>

            <div className="mt-8 border-t border-rule pt-6">
              <p className="font-mono text-micro font-bold uppercase tracking-label text-ink-faint">
                Share this product
              </p>
              <div className="mt-3">
                <ShareProduct
                  productId={product.id}
                  name={product.name}
                  price={product.price.decimal}
                  merchantName={product.merchant.name}
                  url={url}
                />
              </div>
            </div>

            {product.merchant.whatsappNumber && (
              <p className="mt-6 text-small text-ink-faint">
                Question about this item?{' '}
                <a
                  href={`https://wa.me/${product.merchant.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(
                    `Hello ${product.merchant.name}, I have a question about ${product.name} on Musuwo: ${url}`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-support underline"
                >
                  Contact {product.merchant.name}
                </a>
              </p>
            )}
          </div>
        </div>

        {others.length > 0 && (
          <section className="mt-16">
            <h2 className="text-h3 text-support">More from {business.name}</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {others.map((other) => (
                <Link
                  key={other.id}
                  href={productPath(slug, other.slug)}
                  className="flex flex-col border border-rule bg-paper hover:border-support"
                >
                  <ProductPhoto src={other.imageUrl} alt={other.name} />
                  <div className="p-4">
                    <h3 className="font-bold">{other.name}</h3>
                    <p className="mt-2 text-support">${other.price.decimal}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
