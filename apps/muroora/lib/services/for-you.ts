/**
 * SERVER ONLY.
 *
 * Not enforced with the `server-only` package, deliberately. That package
 * throws the moment it is imported outside React's server condition, which
 * includes plain node - so adding it here would make this module impossible to
 * import from db/verify-*.mts, and the verify suites are how every rule on
 * this platform is proved rather than asserted.
 *
 * The guard that actually holds is structural: this module reaches @/db/client,
 * which pulls in the postgres driver, which cannot be bundled for a browser.
 * Importing it from a client component fails the build with "Can't resolve
 * 'fs'" - the same wall that keeps registration.ts out of the application form.
 * See lib/platform/provider-types.ts for the note on that.
 */
import { gte, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { productAnalyticsDaily } from '@/db/schema'
import { platformSettings_many } from '@/lib/platform/settings'
import { getMarketplaceProducts } from '@/lib/services/marketplace-cache'
import type { MarketplaceProduct } from '@/lib/services/marketplace'
import { recentlySeen, viewedProductIds } from '@/lib/services/discovery-events'

/**
 * For You: how Musuwo decides what to show, and why it is arithmetic.
 *
 * NO MACHINE LEARNING, DELIBERATELY. There are three merchants and two real
 * products. A model trained on that would learn that Cotton pants is the
 * platform. What is here instead is a scoring function with every weight in
 * `platform_settings`, so the owner can retune the marketplace from the
 * Control Center without a deploy, and so anybody can read this file and say
 * exactly why a product ranked where it did.
 *
 * THE SCORE
 *
 *   interest      does this customer's own history point at it
 *   performance   do people who see it actually open and buy it
 *   freshness     was it listed recently
 *   merchant      does this merchant complete the orders they take
 *   exploration   a bounded boost for things with no data yet
 *
 * THE TWO RULES THAT MATTER MORE THAN THE SCORE
 *
 * 1. RATES, NOT TOTALS. Performance is views-per-impression and
 *    orders-per-view, never a raw count. A raw count means whatever the feed
 *    already shows most wins, which is the rich-get-richer loop section 26 is
 *    about, and it makes the ranking a function of its own past output.
 *
 * 2. DIVERSITY IS APPLIED AFTER SCORING, NOT INSIDE IT. Scoring answers "how
 *    good is this product"; the interleave answers "what should the customer
 *    see next". Mixing the two produces a weight that has to be retuned every
 *    time a merchant joins. With Muroora holding six of eight products today,
 *    a pure score ordering would be a Muroora catalogue with two other items
 *    at the bottom.
 */

export type ScoredProduct = MarketplaceProduct & {
  /** Why it is here. Shown in the merchant studio, never to a customer. */
  score: number
  reasons: string[]
}

type DailyRow = {
  productId: string
  impressions: number
  views: number
  addToCart: number
  orders: number
  storeEntries: number
}

/**
 * Performance over a trailing window, from the daily rollup rather than raw
 * events. Section 48: no card render aggregates an event table.
 */
async function performanceByProduct(days: number): Promise<Map<string, DailyRow>> {
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - days)
  const sinceDay = since.toISOString().slice(0, 10)

  const rows = await db
    .select({
      productId: productAnalyticsDaily.productId,
      impressions: sql<number>`coalesce(sum(${productAnalyticsDaily.impressions}), 0)::int`,
      views: sql<number>`coalesce(sum(${productAnalyticsDaily.views}), 0)::int`,
      addToCart: sql<number>`coalesce(sum(${productAnalyticsDaily.addToCart}), 0)::int`,
      orders: sql<number>`coalesce(sum(${productAnalyticsDaily.orders}), 0)::int`,
      storeEntries: sql<number>`coalesce(sum(${productAnalyticsDaily.storeEntries}), 0)::int`,
    })
    .from(productAnalyticsDaily)
    .where(gte(productAnalyticsDaily.day, sinceDay))
    .groupBy(productAnalyticsDaily.productId)

  return new Map(rows.map((r) => [r.productId, r]))
}

/**
 * A rate with a prior, so a product seen three times cannot outrank one seen
 * three thousand.
 *
 * Without smoothing, one view from one impression is a 100% open rate and beats
 * everything on the platform for ever. Adding a notional `prior` of average
 * performance means a small sample is pulled towards the middle and only real
 * volume moves it, which is the standard fix and the reason the first version
 * of any ranking system is wrong.
 */
function smoothedRate(hits: number, opportunities: number, prior = 8): number {
  if (opportunities <= 0) return 0
  return hits / (opportunities + prior)
}

function daysSince(iso: string | Date | null): number {
  if (!iso) return 9999
  const then = typeof iso === 'string' ? new Date(iso) : iso
  return (Date.now() - then.getTime()) / 86_400_000
}

/**
 * Order a set of products for one viewer.
 *
 * `sessionId` is required and `userId` is not: an anonymous shopper still gets
 * a feed that does not repeat what they have just scrolled past, without the
 * platform building a profile of who they are.
 */
export async function rankForYou(params: {
  sessionId: string
  userId?: string | null
  /** Restrict to one category, when the customer has chosen one. */
  kind?: string | null
  limit?: number
}): Promise<ScoredProduct[]> {
  const weights = await platformSettings_many({
    feed_weight_interest: 30,
    feed_weight_performance: 25,
    feed_weight_freshness: 15,
    feed_weight_merchant: 10,
    feed_weight_exploration: 20,
    feed_exploration_days: 21,
    feed_max_consecutive_per_merchant: 2,
    feed_page_size: 24,
  })

  const [all, seen, viewed] = await Promise.all([
    getMarketplaceProducts(),
    recentlySeen(params.sessionId),
    params.userId ? viewedProductIds(params.userId) : Promise.resolve([]),
  ])

  const candidates = params.kind
    ? all.filter((p) => p.merchant.kind === params.kind)
    : all
  if (candidates.length === 0) return []

  const perf = await performanceByProduct(30)

  /**
   * What this customer has shown interest in, as merchants and as products.
   * Deliberately shallow: the platform has no category taxonomy on products
   * deep enough to infer taste from, so pretending otherwise would be
   * decoration. Merchant affinity is the honest signal available today.
   */
  const viewedSet = new Set(viewed)
  const affinityMerchants = new Set(
    candidates.filter((p) => viewedSet.has(p.id)).map((p) => p.merchant.slug),
  )

  const scored: ScoredProduct[] = candidates.map((product) => {
    const reasons: string[] = []
    let score = 0

    // ---- interest ---------------------------------------------------------
    if (affinityMerchants.has(product.merchant.slug) && !viewedSet.has(product.id)) {
      score += weights.feed_weight_interest
      reasons.push('You looked at this shop')
    }

    // ---- performance ------------------------------------------------------
    const row = perf.get(product.id)
    if (row) {
      const openRate = smoothedRate(row.views, row.impressions)
      const buyRate = smoothedRate(row.orders, row.views)
      const cartRate = smoothedRate(row.addToCart, row.views)
      const performance = openRate * 0.5 + cartRate * 0.2 + buyRate * 0.3
      score += performance * weights.feed_weight_performance
      if (performance > 0.15) reasons.push('Performs well when shown')
      if (row.storeEntries > 0) reasons.push('Brings people into the shop')
    }

    // ---- freshness --------------------------------------------------------
    const age = daysSince(product.publishedAt ?? null)
    if (age < weights.feed_exploration_days) {
      const decay = 1 - age / weights.feed_exploration_days
      score += decay * weights.feed_weight_freshness
      reasons.push('Recently listed')
    }

    // ---- merchant reliability --------------------------------------------
    // Verification is the only merchant-quality signal that exists today and
    // it means one thing: somebody at Musuwo saw a trading licence. It is
    // weighted lightly on purpose. It must never grow into a quality rating,
    // because customers already over-read the badge.
    if (product.merchant.verified) {
      score += weights.feed_weight_merchant
      reasons.push('Licence checked')
    }

    // ---- exploration ------------------------------------------------------
    // Section 26. A product with no impressions has no performance score and
    // would sit at the bottom for ever, which means it never gets the data it
    // needs to rise. The bonus decays as evidence arrives, so it buys a
    // hearing rather than a permanent advantage, and it is capped below the
    // interest weight so it can never outrank a real signal.
    const impressions = row?.impressions ?? 0
    if (impressions < 50) {
      const unproven = 1 - impressions / 50
      score += unproven * weights.feed_weight_exploration
      if (impressions === 0) reasons.push('Not shown to anyone yet')
    }

    // ---- already seen -----------------------------------------------------
    // Not a filter. A customer who scrolled past something should see fresh
    // things first, but a feed that hard-excludes seen items empties itself
    // on a platform with eight products.
    if (seen.has(product.id)) {
      score *= 0.35
      reasons.push('You have seen this recently')
    }

    return { ...product, score, reasons }
  })

  scored.sort((a, b) => b.score - a.score)

  return interleaveByMerchant(
    scored,
    weights.feed_max_consecutive_per_merchant,
  ).slice(0, params.limit ?? weights.feed_page_size)
}

/**
 * Stop one merchant owning the feed.
 *
 * Walks the scored list in order and, whenever the next item would exceed the
 * consecutive limit for its merchant, reaches ahead for the best-scoring item
 * from anybody else. If there is nobody else - which is the case on this
 * platform most days - it takes the item anyway rather than dropping it. A
 * diversity rule that hides products when only one merchant has stock would
 * empty the marketplace to satisfy a policy about crowding.
 */
export function interleaveByMerchant<T extends { merchant: { slug: string } }>(
  ordered: T[],
  maxConsecutive: number,
): T[] {
  if (maxConsecutive < 1) return ordered

  const pool = [...ordered]
  const out: T[] = []
  let lastSlug: string | null = null
  let run = 0

  while (pool.length > 0) {
    let pick = 0
    if (lastSlug !== null && run >= maxConsecutive) {
      const other = pool.findIndex((item) => item.merchant.slug !== lastSlug)
      if (other !== -1) pick = other
    }

    const [item] = pool.splice(pick, 1)
    if (item.merchant.slug === lastSlug) {
      run += 1
    } else {
      lastSlug = item.merchant.slug
      run = 1
    }
    out.push(item)
  }

  return out
}
