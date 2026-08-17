import { revalidateTag, unstable_cache } from 'next/cache'

import {
  listMarketplaceProducts,
  listPublicBusinesses,
  type MarketplaceProduct,
  type PublicBusiness,
} from './marketplace'

/**
 * The public marketplace feeds, cached and invalidated by tag.
 *
 * WHAT THIS SOLVES
 *
 * The public routes were `force-dynamic`, which is correct but expensive: every
 * visitor hit Postgres for a catalogue that changes a few times a day. Caching
 * them without invalidation is worse - a merchant publishes a product, sees
 * nothing change, and publishes it again.
 *
 * So both feeds are cached indefinitely and dropped the moment something
 * happens that could change them. A newly approved business appears on the
 * website and in the app on their next fetch, with NO redeploy of either. That
 * is the requirement from the handoff, made mechanical.
 *
 * WHY TAGS AND NOT A TIME LIMIT
 *
 * A revalidate window means the marketplace is knowingly wrong for that long.
 * With a suspended business that is not a stale cache, it is a business that
 * asked to be taken down and is still listed. Tags make the invalidation exact
 * and immediate; the `revalidate: 300` below is only a backstop in case an
 * invalidation is ever missed, never the primary mechanism.
 */

export const MARKETPLACE_TAGS = {
  /** Anything affecting which businesses the public can see. */
  businesses: 'musuwo:businesses',
  /** Anything affecting which products the public can see. */
  products: 'musuwo:products',
} as const

/**
 * A business's visibility and its products' visibility are linked: suspending
 * a business must withdraw its products too. Callers should not have to
 * remember that, so approval-shaped changes drop both.
 */
/**
 * `{ expire: 0 }` means drop it now, not soon.
 *
 * Next 16 requires a cacheLife profile as the second argument. A named profile
 * like "max" would leave the old answer in place for a while, which is exactly
 * wrong when the change being published is a business asking to be delisted.
 */
const IMMEDIATELY = { expire: 0 } as const

export function revalidateMarketplace(
  scope: 'businesses' | 'products' | 'all' = 'all',
): void {
  if (scope === 'all' || scope === 'businesses') {
    revalidateTag(MARKETPLACE_TAGS.businesses, IMMEDIATELY)
  }
  if (scope === 'all' || scope === 'products') {
    revalidateTag(MARKETPLACE_TAGS.products, IMMEDIATELY)
  }
}

export const getPublicBusinesses = unstable_cache(
  async (): Promise<PublicBusiness[]> => listPublicBusinesses(),
  ['musuwo-public-businesses'],
  { tags: [MARKETPLACE_TAGS.businesses], revalidate: 300 },
)

export const getMarketplaceProducts = unstable_cache(
  async (): Promise<MarketplaceProduct[]> => listMarketplaceProducts(),
  ['musuwo-marketplace-products'],
  {
    // Both tags on purpose. A product's visibility depends on its business
    // being publicly visible, so suspending a business has to drop this too.
    tags: [MARKETPLACE_TAGS.products, MARKETPLACE_TAGS.businesses],
    revalidate: 300,
  },
)
