import type { Metadata } from 'next'

import { MusuwoShopCatalogue } from '@/app/shop/MusuwoShopCatalogue'
import { getMarketplaceProducts } from '@/lib/services/marketplace-cache'
import { currentUser } from '@/lib/auth'
import { listRecommendedProducts } from '@/lib/services/marketplace'

export const dynamic = 'force-dynamic'

/**
 * /shop, and it is a DIFFERENT SHOP on each site.
 *
 * WHAT WAS BROKEN. Muroora Mart's own navigation has a "Shop" link pointing
 * here, and this route had been taken over by the Musuwo cross-marketplace
 * catalogue. So a customer on muroora-mart.vercel.app - a grocer's website -
 * clicked Shop and landed on a page headed "Musuwo Shop", carrying another
 * brand's logo and colours, listing nothing at all, because the Musuwo
 * catalogue was hard-coded to an empty array.
 *
 * That is the whole complaint in one page: somebody signing in to Muroora Mart
 * to buy groceries should buy from Muroora Mart. Musuwo is the layer
 * underneath - it takes the order and it delivers - and the customer does not
 * need it put in front of them to shop.
 *
 * So this switches on the brand, exactly as `/` does:
 *
 *   muroora  Muroora Mart's own shelves, from its own catalogue.
 *   musuwo   products from every business that has published to Musuwo, each
 *            one naming the business selling it.
 *
 * The Musuwo half now reads the real marketplace feed rather than `[]`.
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Shop across Musuwo',
    description: 'Products from approved businesses across Musuwo, each one showing who is selling it.',
  }
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams

  const user = await currentUser()
  const [marketplace, recommended] = await Promise.all([
    getMarketplaceProducts(),
    user ? listRecommendedProducts(user.id) : Promise.resolve([]),
  ])

  // Shaped for the Musuwo catalogue component, which was written against its
  // own type. Mapping here keeps that component unaware of the service.
  const products = marketplace.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    unitSize: p.unitSize,
    price: p.price.decimal,
    imageUrl: p.imageUrl,
    merchant: {
      name: p.merchant.name,
      slug: p.merchant.slug,
      logoUrl: p.merchant.logoPath,
      whatsappNumber: p.merchant.whatsappNumber,
      websiteUrl: p.merchant.websiteUrl,
    },
  }))

  return (
    <MusuwoShopCatalogue
      products={products}
      recommendedIds={recommended.map((product) => product.id)}
      initialQuery={q ?? ''}
      signedIn={Boolean(user)}
    />
  )
}
