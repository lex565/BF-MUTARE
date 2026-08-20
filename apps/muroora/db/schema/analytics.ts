import {
  bigint,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import { currencyEnum, id } from './_shared'
import { users } from './identity'
import { products } from './catalogue'
import { businesses } from './marketplace'

/**
 * What customers do, and what it adds up to.
 *
 * Created by migration 0020_discovery_events.sql, which carries the reasoning.
 * The short version of the one rule that matters:
 *
 *   An IMPRESSION is "this was visible in somebody's feed".
 *   A VIEW is "somebody chose to open it".
 *
 * They are separate event types and nothing converts one into the other. A
 * feed that treats them as the same thing learns to promote whatever it
 * already shows most, which is the failure mode the brief is written against.
 */

export const productEventTypeEnum = pgEnum('product_event_type', [
  'PRODUCT_IMPRESSION',
  'PRODUCT_VIEW',
  'STORE_VISIT',
  'ADD_TO_CART',
  'REMOVE_FROM_CART',
  'CHECKOUT_STARTED',
  'ORDER_COMPLETED',
  'PRODUCT_SHARED',
  'SEARCH_RESULT_CLICKED',
])

/** Where the customer was standing when it happened. */
export const discoverySurfaceEnum = pgEnum('discovery_surface', [
  'FOR_YOU',
  'SEARCH',
  'STOREFRONT',
  'CATEGORY',
  'SHARED_LINK',
  'DIRECT',
  'MOBILE_APP',
  'OTHER',
])

export const productEvents = pgTable(
  'product_events',
  {
    id: id(),
    eventType: productEventTypeEnum('event_type').notNull(),
    surface: discoverySurfaceEnum('surface').notNull().default('OTHER'),

    /** Null for a store visit that did not arrive through a product. */
    productId: uuid('product_id').references(() => products.id, {
      onDelete: 'cascade',
    }),

    /**
     * Never null. Every event belongs to exactly one merchant, denormalised
     * onto the row so "my products only" is a column filter rather than a
     * three-table join repeated on every analytics read.
     */
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),

    /**
     * The product somebody came through, on a STORE_VISIT.
     *
     * This one column is the whole of "store discovery generated": it answers
     * "how many people walked into this shop because of this item", which is
     * a different and often more valuable number than what the item sold.
     */
    entryProductId: uuid('entry_product_id').references(() => products.id, {
      onDelete: 'set null',
    }),

    /** Null for anonymous browsing, which stays legitimate and unidentified. */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    /** An opaque rotating value. It identifies a browsing session, not a person. */
    sessionId: text('session_id').notNull(),

    /**
     * Set when the event is real but must not count towards anything.
     *
     * The row is still written. Deleting inflated or self-generated events
     * would destroy the evidence that the filter works, and the first question
     * anybody asks about an analytics number is what was thrown away.
     */
    excludedReason: text('excluded_reason'),

    /**
     * Server-computed from session, product, type and a time bucket. UNIQUE,
     * so deduplication is the database's job rather than something the
     * application has to remember. Null for ORDER_COMPLETED, because two
     * genuine orders a minute apart are two orders.
     */
    dedupeKey: text('dedupe_key'),

    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
  },
  (t) => [
    uniqueIndex('product_events_dedupe_uniq').on(t.dedupeKey),
    index('product_events_product_idx').on(t.productId, t.eventType, t.occurredAt),
    index('product_events_business_idx').on(t.businessId, t.occurredAt),
    index('product_events_entry_idx').on(t.entryProductId),
  ],
)

export const productAnalyticsDaily = pgTable(
  'product_analytics_daily',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),

    impressions: integer('impressions').notNull().default(0),
    views: integer('views').notNull().default(0),
    /** Distinct sessions that opened it. Always at most `views`. */
    uniqueViewers: integer('unique_viewers').notNull().default(0),
    addToCart: integer('add_to_cart').notNull().default(0),
    orders: integer('orders').notNull().default(0),
    shares: integer('shares').notNull().default(0),
    /** Store visits this product was the doorway for. */
    storeEntries: integer('store_entries').notNull().default(0),
    revenueAmount: bigint('revenue_amount', { mode: 'bigint' })
      .notNull()
      .default(0n),
    revenueCurrency: currencyEnum('revenue_currency').notNull().default('USD'),

    computedAt: timestamp('computed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.day] }),
    index('product_daily_business_idx').on(t.businessId, t.day),
  ],
)

export const merchantAnalyticsDaily = pgTable(
  'merchant_analytics_daily',
  {
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),

    storeVisits: integer('store_visits').notNull().default(0),
    uniqueVisitors: integer('unique_visitors').notNull().default(0),
    impressions: integer('impressions').notNull().default(0),
    views: integer('views').notNull().default(0),
    addToCart: integer('add_to_cart').notNull().default(0),
    orders: integer('orders').notNull().default(0),
    revenueAmount: bigint('revenue_amount', { mode: 'bigint' })
      .notNull()
      .default(0n),
    revenueCurrency: currencyEnum('revenue_currency').notNull().default('USD'),

    computedAt: timestamp('computed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.day] })],
)

/**
 * What people asked Musuwo for.
 *
 * Search is currently a filter in the browser, which leaves no trace, which
 * means the single most commercially useful report in the brief - what Mutare
 * is searching for that nobody is selling - cannot be written. The raw text is
 * kept alongside the normalised form because normalising is lossy, and the
 * first time the report looks wrong the raw text is the only way to find out
 * why.
 */
export const searchQueries = pgTable(
  'search_queries',
  {
    id: id(),
    queryRaw: text('query_raw').notNull(),
    queryNormalised: text('query_normalised').notNull(),
    resultCount: integer('result_count').notNull(),
    surface: discoverySurfaceEnum('surface').notNull().default('SEARCH'),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    sessionId: text('session_id').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('search_queries_normalised_idx').on(t.queryNormalised, t.occurredAt)],
)
