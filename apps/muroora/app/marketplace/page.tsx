import type { Metadata } from 'next'

import { getPublicBusinesses, getMarketplaceProducts } from '@/lib/services/marketplace-cache'
import { MarketplaceList } from '@/app/marketplace/MarketplaceList'

/**
 * The Musuwo directory.
 *
 * WAS A PREVIEW, IS NOW A LIST. It used to render nine invented businesses
 * from an array - a bookshop, a boarding house, a tutor - each with a price
 * and an area, none of which existed. It was also `robots: noindex`, because
 * nobody wanted it found. Both facts have gone: this reads the database, so
 * everything on it is real and it is worth indexing.
 */
export const metadata: Metadata = {
  title: 'Businesses on Musuwo',
  description:
    'Local businesses in Mutare and across Zimbabwe, each reviewed by a person before being listed on Musuwo.',
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  // The homepage search box sends people here with ?q=. Honouring it means a
  // search from the front page lands on results rather than on an unfiltered
  // list the person then has to search again.
  const { q } = await searchParams
  // Through the cache, same as the homepage, so the two cannot disagree about
  // who is listed. Both are dropped by tag the moment a business is approved,
  // suspended or verified.
  const [businesses, products] = await Promise.all([
    getPublicBusinesses(),
    getMarketplaceProducts(),
  ])

  return (
    <MarketplaceList
      businesses={businesses}
      products={products}
      initialQuery={q ?? ''}
    />
  )
}
