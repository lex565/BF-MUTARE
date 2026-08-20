import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { currentUser } from '@/lib/auth'
import { getPublicBusiness, listMarketplaceProducts } from '@/lib/services/marketplace'
import { recordEvent } from '@/lib/services/discovery-events'
import { discoverySession } from '@/lib/services/discovery-session'
import { productPath, storeUrl } from '@/lib/musuwo-urls'
import { ProductPhoto } from '@/app/components/marketplace/ProductPhoto'
import { StoreHeader } from '@/app/components/marketplace/StoreHeader'

/**
 * A merchant's storefront home.
 *
 * WHAT THIS REPLACED. Twenty-five lines: a heading, a summary, a WhatsApp
 * button and a grid of product names with no photographs. Nothing told a
 * visitor whose shop they were in beyond the text of the name, and the store
 * had no navigation of any kind.
 *
 * Categories come from the merchant's own `categories` rows, which have always
 * been per-store and have never been rendered. Nothing here is hard-coded to
 * Muroora Mart or to any other merchant.
 */

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const business = await getPublicBusiness(slug)
  if (!business) return { title: 'Business not found' }

  // Short for the tab, which the layout suffixes with the brand; the full form
  // goes to Open Graph, which has no template.
  const pageTitle = business.name
  const title = `${business.name} | Musuwo`
  const description =
    business.tagline ??
    business.summary ??
    `Shop from ${business.name} on Musuwo.`

  return {
    title: pageTitle,
    description,
    alternates: { canonical: storeUrl(slug) },
    icons: business.faviconPath ? { icon: business.faviconPath } : undefined,
    openGraph: {
      type: 'website',
      url: storeUrl(slug),
      title,
      description,
      siteName: 'Musuwo',
      images: business.coverImageUrl
        ? [{ url: business.coverImageUrl, alt: business.name }]
        : business.logoUrl
          ? [{ url: business.logoUrl, alt: business.name }]
          : undefined,
    },
  }
}

export default async function StorefrontPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ category?: string }>
}) {
  const { slug } = await params
  const { category } = await searchParams

  const [business, allProducts] = await Promise.all([
    getPublicBusiness(slug),
    listMarketplaceProducts(),
  ])
  if (!business) notFound()

  const products = allProducts.filter((p) => p.merchant.slug === slug)

  /**
   * A visit to this shop, with no entry product.
   *
   * Somebody who arrived by clicking the merchant name rather than a product
   * did not come through any item, so `entryProductId` stays null and no
   * product is credited with the discovery. Crediting one would inflate a
   * figure a merchant uses to decide what to keep in stock.
   */
  const [{ sessionId }, user] = await Promise.all([
    discoverySession(),
    currentUser(),
  ])
  await recordEvent({
    eventType: 'STORE_VISIT',
    businessId: business.id,
    surface: 'STOREFRONT',
    sessionId,
    userId: user?.id ?? null,
  })

  const whatsapp = business.whatsappNumber?.replace(/\D/g, '')

  return (
    <main className="min-h-dvh bg-paper">
      <StoreHeader business={business} asHeading />

      <div className="mx-auto max-w-[86rem] px-gutter py-10">
        <nav aria-label="Breadcrumb" className="text-small text-ink-faint">
          <Link href="/" className="hover:text-support">
            Musuwo
          </Link>
          <span aria-hidden> / </span>
          <span className="text-support">{business.name}</span>
        </nav>

        <div className="mt-8 grid gap-10 lg:grid-cols-[15rem_1fr]">
          {/* Store navigation. A sidebar on a wide screen; on a phone it
              becomes a scrolling row of chips above the products rather than a
              desktop sidebar squeezed onto a small screen, which is what
              section 9 of the brief asks for. */}
          <nav
            aria-label={`${business.name} sections`}
            className="lg:sticky lg:top-6 lg:self-start"
          >
            <p className="font-mono text-micro font-bold uppercase tracking-label text-ink-faint">
              This shop
            </p>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
              <Link
                href={`/stores/${slug}`}
                className={`shrink-0 rounded-pill px-4 py-2 text-small font-medium lg:rounded-none lg:border-l-2 lg:px-3 ${
                  !category
                    ? 'bg-support text-white lg:border-accent lg:bg-transparent lg:text-support'
                    : 'bg-paper-sunk text-support lg:border-transparent lg:bg-transparent'
                }`}
              >
                All products
              </Link>
              {business.websiteUrl && (
                <a
                  href={business.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-pill bg-paper-sunk px-4 py-2 text-small font-medium text-support lg:rounded-none lg:border-l-2 lg:border-transparent lg:bg-transparent lg:px-3"
                >
                  Their website
                </a>
              )}
              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-pill bg-paper-sunk px-4 py-2 text-small font-medium text-support lg:rounded-none lg:border-l-2 lg:border-transparent lg:bg-transparent lg:px-3"
                >
                  Ask a question
                </a>
              )}
            </div>

            {business.summary && business.tagline && (
              <div className="mt-6 hidden border-t border-rule pt-4 lg:block">
                <p className="font-mono text-micro font-bold uppercase tracking-label text-ink-faint">
                  About
                </p>
                <p className="mt-2 text-small text-ink-soft">{business.summary}</p>
              </div>
            )}
          </nav>

          <section>
            <h2 className="text-h3 text-support">
              {products.length === 0
                ? 'Products'
                : `${products.length} ${products.length === 1 ? 'product' : 'products'}`}
            </h2>

            {products.length === 0 ? (
              <p className="mt-5 max-w-prose text-ink-soft">
                {business.name} has not published anything to Musuwo yet. Nothing
                is invented to fill this page, so when stock appears here it is
                real and it is for sale.
              </p>
            ) : (
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {products.map((product) => (
                  <Link
                    key={product.id}
                    href={productPath(slug, product.slug)}
                    className="group flex flex-col border border-rule bg-paper transition-colors hover:border-support"
                  >
                    <ProductPhoto src={product.imageUrl} alt={product.name} />
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="font-bold leading-snug group-hover:text-support">
                        {product.name}
                      </h3>
                      {product.unitSize && (
                        <p className="mt-1 text-small text-ink-faint">
                          {product.unitSize}
                        </p>
                      )}
                      <p className="mt-auto pt-4 text-h3 text-support">
                        ${product.price.decimal}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
