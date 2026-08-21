import { relations, sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import {
  currencyEnum,
  id,
  metadata,
  serviceabilityReasonEnum,
  storeId,
  timestamps,
} from './_shared'
import { stores } from './catalogue'
import { orders } from './orders'
import { users } from './identity'
import { businesses } from './marketplace'

/**
 * Delivery zones and payments.
 *
 * Riders, dispatch and earnings are Phases 3-5 and are deliberately NOT here
 * yet. What is here is what Phase 1-2 needs: somewhere to compute a delivery
 * fee, and a payments table that records money without committing to a
 * provider.
 */

/**
 * Zones.
 *
 * The brief: "Do not calculate arbitrary nationwide delivery yet." Zones are
 * admin-configured suburb lists with a flat fee, which is how delivery
 * actually gets priced in Mutare - by area, not by a routing API.
 *
 * `perKmFeeAmount` exists unused so distance pricing can be switched on later
 * without a migration.
 */
export const deliveryZones = pgTable(
  'delivery_zones',
  {
    id: id(),
    storeId: storeId().references(() => stores.id),
    name: text('name').notNull(),
    description: text('description'),

    /** Suburbs in this zone. Matched case-insensitively at checkout. */
    suburbs: text('suburbs').array().notNull().default([]),

    currency: currencyEnum('currency').notNull().default('USD'),
    baseFeeAmount: bigint('base_fee_amount', { mode: 'bigint' }).notNull(),
    /** Reserved for distance-based pricing. Null until that engine exists. */
    perKmFeeAmount: bigint('per_km_fee_amount', { mode: 'bigint' }),
    minimumOrderAmount: bigint('minimum_order_amount', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),

    estimatedMinutesMin: integer('estimated_minutes_min'),
    estimatedMinutesMax: integer('estimated_minutes_max'),
    maxDistanceKm: integer('max_distance_km'),

    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (t) => [index('delivery_zones_store_idx').on(t.storeId, t.isActive)],
)

/**
 * Payments.
 *
 * The brief: "Do not integrate a live payment gateway until the actual
 * Zimbabwe/business payment provider is selected. Build an abstraction."
 *
 * So `provider` is free text - 'ecocash', 'innbucks', 'cash_on_delivery',
 * 'manual' - and no SDK is imported anywhere. This table can record a payment
 * a staff member confirmed by hand today, and the same rows will describe a
 * gateway's callbacks later without changing shape.
 */
export const paymentStatusEnum = pgEnum('payment_status', [
  'PENDING',
  'PROCESSING',
  'PAID',
  'FAILED',
  'REFUNDED',
  'PARTIAL_REFUND',
])

export const payments = pgTable(
  'payments',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),

    /** 'ecocash' | 'innbucks' | 'cash_on_delivery' | 'manual' | future gateway */
    provider: text('provider').notNull(),
    /** The provider's own reference. Unique per provider once one exists. */
    providerReference: text('provider_reference'),
    method: text('method'),

    amount: bigint('amount', { mode: 'bigint' }).notNull(),
    currency: currencyEnum('currency').notNull().default('USD'),

    status: paymentStatusEnum('status').notNull().default('PENDING'),
    paidAt: timestamp('paid_at', { withTimezone: true }),

    /** Who marked it paid, when that was a human rather than a callback. */
    confirmedBy: uuid('confirmed_by').references(() => users.id),
    metadata: metadata(),
    ...timestamps(),
  },
  (t) => [
    index('payments_order_idx').on(t.orderId),
    index('payments_provider_ref_idx').on(t.provider, t.providerReference),
  ],
)

/**
 * Idempotency keys.
 *
 * The brief asks for idempotency, and checkout is where it earns its keep: a
 * customer on a bad connection who taps "Place order" twice must not get two
 * orders and two stock deductions. The key is the client-supplied token; the
 * stored response is replayed on a repeat.
 */
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    key: text('key').primaryKey(),
    scope: text('scope').notNull(),
    userId: uuid('user_id').references(() => users.id),
    /** JSON of the original response, replayed verbatim on a retry. */
    response: text('response'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('idempotency_expiry_idx').on(t.expiresAt)],
)

/**
 * Audit log.
 *
 * Separate from order_events: that one is the life of an order, this is every
 * privileged action anywhere in the system. It is what answers "who changed
 * this price", and - the reason it matters most - "who opened that rider's ID
 * document, and when". See D-005.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    storeId: uuid('store_id'),
    actorId: uuid('actor_id').references(() => users.id),
    actorRole: text('actor_role'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    /** Before/after for the fields that changed. Never the whole row. */
    changes: metadata(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('audit_entity_idx').on(t.entityType, t.entityId),
    index('audit_actor_idx').on(t.actorId, t.createdAt),
  ],
)

/* ================================================================ pricing */

/**
 * Road-distance delivery pricing. Migration 0025.
 *
 * These tables implement MUSUWO_DELIVERY_PRICING_IMPLEMENTATION_HANDOFF.md.
 * They sit BESIDE `delivery_zones` above rather than replacing it: a zone says
 * where Musuwo is willing to go, a tariff says what the trip costs, and those
 * are different questions. Nothing has ever been priced by a zone - both live
 * zones are inactive placeholders - so there was no history to migrate.
 *
 * The arithmetic lives in lib/delivery/tariff.ts and deliberately not here.
 */


/**
 * Versioned tariffs. Rows are added, never edited.
 *
 * A partial unique index in the migration allows exactly one `isActive` row,
 * because a fee that depends on which of two rows a query returned first is
 * not a fee, it is a coin toss.
 */
export const deliveryTariffs = pgTable('delivery_tariffs', {
  version: text('version').primaryKey(),
  currency: currencyEnum('currency').notNull().default('USD'),
  /** Ascending, inclusive upper bounds: [{ maxMetres, feeCents }, ...]. */
  bands: jsonb('bands')
    .$type<{ maxMetres: number; feeCents: number }[]>()
    .notNull(),
  maxStandardMetres: integer('max_standard_metres').notNull(),
  oversizeFeeCents: integer('oversize_fee_cents').notNull().default(200),
  includedWaitingMinutes: integer('included_waiting_minutes').notNull().default(10),
  waitingBlockMinutes: integer('waiting_block_minutes').notNull().default(10),
  waitingBlockFeeCents: integer('waiting_block_fee_cents').notNull().default(100),
  returnPercent: integer('return_percent').notNull().default(75),
  isActive: boolean('is_active').notNull().default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
})

/**
 * Every quote the server issued, serviceable or not.
 *
 * Checkout submits a quote id and the server revalidates it here. That is only
 * meaningful because the server kept its own copy: a quote the client can
 * describe but the server cannot recognise is a price the client invented.
 *
 * Refusals are kept too. "How often did we say no, and why" is what decides
 * whether 15 km is the right limit, and it can never be answered from orders,
 * because a refusal never becomes one.
 */
export const deliveryQuotes = pgTable(
  'delivery_quotes',
  {
    id: id(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id').references(() => stores.id),

    pricingVersion: text('pricing_version')
      .notNull()
      .references(() => deliveryTariffs.version),
    serviceable: boolean('serviceable').notNull(),
    serviceabilityReason: serviceabilityReasonEnum('serviceability_reason').notNull(),

    originLatitude: doublePrecision('origin_latitude'),
    originLongitude: doublePrecision('origin_longitude'),
    destinationLatitude: doublePrecision('destination_latitude'),
    destinationLongitude: doublePrecision('destination_longitude'),

    roadDistanceM: integer('road_distance_m'),
    estimatedTimeSeconds: integer('estimated_time_seconds'),
    routingProvider: text('routing_provider'),
    routingDataVersion: text('routing_data_version'),

    standardFeeCents: integer('standard_fee_cents'),
    oversizeFeeCents: integer('oversize_fee_cents').notNull().default(0),
    promotionSubsidyCents: integer('promotion_subsidy_cents').notNull().default(0),
    customerFeeCents: integer('customer_fee_cents'),
    currency: currencyEnum('currency').notNull().default('USD'),
    isHeavyOrOversized: boolean('is_heavy_or_oversized').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    consumedByOrderId: uuid('consumed_by_order_id'),
  },
  (t) => [
    index('delivery_quotes_business_idx').on(t.businessId, t.createdAt),
    index('delivery_quotes_reason_idx').on(t.serviceabilityReason, t.createdAt),
  ],
)

/**
 * Charges raised AFTER the customer agreed a price.
 *
 * Append only, enforced by rules on the table itself - see migration 0025.
 * Rules rather than a trigger on purpose: migration 0022 taught this codebase
 * that a trigger raising on DELETE breaks ON DELETE CASCADE, and this table
 * hangs off orders.
 *
 * A correction is a new MANUAL_ADJUSTMENT row, never an edit. These are
 * charges against somebody after the fact, so the record of who raised one and
 * why is the only thing standing between the company and a dispute it cannot
 * answer.
 */
export const orderCharges = pgTable(
  'order_charges',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    /** WAITING | REDELIVERY | RETURN_TO_MERCHANT | MANUAL_ADJUSTMENT */
    chargeType: text('charge_type').notNull(),
    /** Only MANUAL_ADJUSTMENT may be negative, and that is why it exists. */
    amountCents: integer('amount_cents').notNull(),
    currency: currencyEnum('currency').notNull().default('USD'),
    reason: text('reason').notNull(),
    actorId: uuid('actor_id').references(() => users.id),
    actorRole: text('actor_role'),
    detail: jsonb('detail').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('order_charges_order_idx').on(t.orderId, t.createdAt)],
)

export const deliveryZonesRelations = relations(deliveryZones, ({ one }) => ({
  store: one(stores, {
    fields: [deliveryZones.storeId],
    references: [stores.id],
  }),
}))

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
}))

export const deliveryQuotesRelations = relations(deliveryQuotes, ({ one }) => ({
  business: one(businesses, {
    fields: [deliveryQuotes.businessId],
    references: [businesses.id],
  }),
  tariff: one(deliveryTariffs, {
    fields: [deliveryQuotes.pricingVersion],
    references: [deliveryTariffs.version],
  }),
}))

export const orderChargesRelations = relations(orderCharges, ({ one }) => ({
  order: one(orders, { fields: [orderCharges.orderId], references: [orders.id] }),
}))
