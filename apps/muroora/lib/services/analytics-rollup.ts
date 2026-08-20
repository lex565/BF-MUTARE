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
import { sql } from 'drizzle-orm'

import { db } from '@/db/client'

/**
 * Turning raw events into the numbers a merchant reads.
 *
 * WHY A ROLLUP AND NOT A LIVE QUERY
 *
 * Every merchant analytics page and every For You request needs "how did this
 * product do". Answering that from `product_events` means scanning an
 * append-only table that grows for ever, on every page load, for every
 * merchant. Section 48 rules it out and it would be the first thing to fall
 * over.
 *
 * The rollup is fully derivable from the events, which is the property that
 * matters: if this file has a bug, it can be fixed and re-run over history. If
 * the events were wrong there would be nothing to recompute from.
 *
 * WHY IT IS IDEMPOTENT
 *
 * Every statement is an INSERT ... ON CONFLICT DO UPDATE keyed on the natural
 * primary key, and every value is a SET rather than an increment. Running this
 * twice for the same day produces the same numbers as running it once, and a
 * day can be recomputed at any time without first deleting anything. An
 * incrementing rollup would double every figure the second time somebody ran
 * it, and somebody always runs it twice.
 *
 * WHY EXCLUDED EVENTS ARE FILTERED HERE AND NOT AT WRITE TIME
 *
 * `excluded_reason IS NULL` appears in every aggregate below. The rows still
 * exist, so "how many self-views did this merchant generate" stays answerable,
 * but they never reach a number anybody makes a decision on.
 */

/** The day to roll up, as UTC. Orders and impressions are stamped in UTC. */
function isoDay(day: Date): string {
  return day.toISOString().slice(0, 10)
}

/**
 * Recompute one day of product-level analytics.
 *
 * `unique_viewers` counts distinct sessions rather than distinct users,
 * because most shoppers are not signed in, and counting only the signed-in
 * ones would tell a merchant their product was seen by two people when it was
 * seen by two hundred.
 */
export async function rollUpProducts(day: Date = new Date()): Promise<number> {
  const d = isoDay(day)

  const result = await db.execute(sql`
    INSERT INTO product_analytics_daily (
      product_id, business_id, day,
      impressions, views, unique_viewers, add_to_cart, orders, shares,
      store_entries, computed_at
    )
    SELECT
      e.product_id,
      e.business_id,
      ${d}::date,
      count(*) FILTER (WHERE e.event_type = 'PRODUCT_IMPRESSION')::int,
      count(*) FILTER (WHERE e.event_type = 'PRODUCT_VIEW')::int,
      count(DISTINCT e.session_id) FILTER (WHERE e.event_type = 'PRODUCT_VIEW')::int,
      count(*) FILTER (WHERE e.event_type = 'ADD_TO_CART')::int,
      count(*) FILTER (WHERE e.event_type = 'ORDER_COMPLETED')::int,
      count(*) FILTER (WHERE e.event_type = 'PRODUCT_SHARED')::int,
      -- Store visits this product was the doorway for. Counted from the
      -- entry column on a different row, which is why it is a subquery
      -- rather than another FILTER over the same rows.
      (
        SELECT count(*)::int FROM product_events se
        WHERE se.entry_product_id = e.product_id
          AND se.event_type = 'STORE_VISIT'
          AND se.excluded_reason IS NULL
          AND se.occurred_at >= ${d}::date
          AND se.occurred_at <  ${d}::date + 1
      ),
      now()
    FROM product_events e
    WHERE e.product_id IS NOT NULL
      AND e.excluded_reason IS NULL
      AND e.occurred_at >= ${d}::date
      AND e.occurred_at <  ${d}::date + 1
    GROUP BY e.product_id, e.business_id
    ON CONFLICT (product_id, day) DO UPDATE SET
      business_id    = EXCLUDED.business_id,
      impressions    = EXCLUDED.impressions,
      views          = EXCLUDED.views,
      unique_viewers = EXCLUDED.unique_viewers,
      add_to_cart    = EXCLUDED.add_to_cart,
      orders         = EXCLUDED.orders,
      shares         = EXCLUDED.shares,
      store_entries  = EXCLUDED.store_entries,
      computed_at    = now()
  `)

  return Number((result as { count?: number }).count ?? 0)
}

/**
 * Recompute one day of merchant-level analytics.
 *
 * Not a sum of the product rows. A store visit that arrived through no product
 * belongs to the merchant and to no product, so summing the product table
 * would lose it. This aggregates the events directly.
 */
export async function rollUpMerchants(day: Date = new Date()): Promise<number> {
  const d = isoDay(day)

  const result = await db.execute(sql`
    INSERT INTO merchant_analytics_daily (
      business_id, day,
      store_visits, unique_visitors, impressions, views, add_to_cart, orders,
      computed_at
    )
    SELECT
      e.business_id,
      ${d}::date,
      count(*) FILTER (WHERE e.event_type = 'STORE_VISIT')::int,
      count(DISTINCT e.session_id) FILTER (WHERE e.event_type = 'STORE_VISIT')::int,
      count(*) FILTER (WHERE e.event_type = 'PRODUCT_IMPRESSION')::int,
      count(*) FILTER (WHERE e.event_type = 'PRODUCT_VIEW')::int,
      count(*) FILTER (WHERE e.event_type = 'ADD_TO_CART')::int,
      count(*) FILTER (WHERE e.event_type = 'ORDER_COMPLETED')::int,
      now()
    FROM product_events e
    WHERE e.excluded_reason IS NULL
      AND e.occurred_at >= ${d}::date
      AND e.occurred_at <  ${d}::date + 1
    GROUP BY e.business_id
    ON CONFLICT (business_id, day) DO UPDATE SET
      store_visits    = EXCLUDED.store_visits,
      unique_visitors = EXCLUDED.unique_visitors,
      impressions     = EXCLUDED.impressions,
      views           = EXCLUDED.views,
      add_to_cart     = EXCLUDED.add_to_cart,
      orders          = EXCLUDED.orders,
      computed_at     = now()
  `)

  return Number((result as { count?: number }).count ?? 0)
}

/**
 * Roll up today and yesterday.
 *
 * Yesterday as well as today because a rollup that only ever touches the
 * current day leaves the final hours of every day permanently unaggregated
 * once midnight passes, and because a customer in the UK buying from the
 * diaspora shop is several hours away from Mutare.
 */
export async function rollUpRecent(): Promise<{ products: number; merchants: number }> {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)

  let productRows = 0
  let merchantRows = 0
  for (const day of [yesterday, today]) {
    productRows += await rollUpProducts(day)
    merchantRows += await rollUpMerchants(day)
  }
  return { products: productRows, merchants: merchantRows }
}
