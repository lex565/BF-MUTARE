import { relations, sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import { currencyEnum, id, metadata, storeId, timestamps } from './_shared'
import { stores } from './catalogue'
import { orders } from './orders'
import { users } from './identity'

/**
 * Delivery zones and payments.
 *
 * Riders, dispatch and earnings are Phases 3–5 and are deliberately NOT here
 * yet. What is here is what Phase 1–2 needs: somewhere to compute a delivery
 * fee, and a payments table that records money without committing to a
 * provider.
 */

/**
 * Zones.
 *
 * The brief: "Do not calculate arbitrary nationwide delivery yet." Zones are
 * admin-configured suburb lists with a flat fee, which is how delivery
 * actually gets priced in Mutare — by area, not by a routing API.
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
 * So `provider` is free text — 'ecocash', 'innbucks', 'cash_on_delivery',
 * 'manual' — and no SDK is imported anywhere. This table can record a payment
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
 * this price", and — the reason it matters most — "who opened that rider's ID
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

export const deliveryZonesRelations = relations(deliveryZones, ({ one }) => ({
  store: one(stores, {
    fields: [deliveryZones.storeId],
    references: [stores.id],
  }),
}))

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
}))
