import { relations } from 'drizzle-orm'
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import { id, metadata, storeId, timestamps } from './_shared'
import { products, stores } from './catalogue'
import { users } from './identity'

/**
 * Stock, as a balance plus a ledger.
 *
 * The brief is explicit and correct: "Create an inventory ledger rather than
 * only overwriting one number."
 *
 * `inventory.quantity` is the balance. `inventory_transactions` is the history
 * of every movement that produced it. The two are written in the SAME database
 * transaction, never separately - see lib/inventory.ts, which is the only
 * place in the codebase allowed to touch either.
 *
 * Why it matters for a grocer: when the till says 40 bags of mealie-meal and
 * the shelf has 36, somebody has to be able to find out where four went. A
 * single mutable number can only ever answer "40", and cannot say who changed
 * it, when, or why.
 */

export const inventoryTxTypeEnum = pgEnum('inventory_tx_type', [
  'RESTOCK',
  'SALE',
  'RETURN',
  'DAMAGED',
  'LOST',
  'MANUAL_ADJUSTMENT',
  'CANCELLED_ORDER_RESTOCK',
  /** Held for an order that is placed but not yet packed. */
  'RESERVATION',
  'RESERVATION_RELEASED',
])

export const inventory = pgTable(
  'inventory',
  {
    id: id(),
    storeId: storeId().references(() => stores.id),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),

    /** On the shelf, including anything currently reserved. */
    quantity: integer('quantity').notNull().default(0),

    /**
     * Committed to unfulfilled orders. Sellable = quantity - reserved.
     *
     * Tracked separately so two customers cannot both buy the last bag of rice
     * between checkout and packing. The brief calls for stock to be "reserved
     * appropriately during checkout/order confirmation".
     */
    reserved: integer('reserved').notNull().default(0),

    /**
     * Whether this product may go below zero. Default false.
     * The brief: "Do not allow negative stock unless explicitly configured."
     */
    allowNegative: text('allow_negative').notNull().default('false'),

    lastCountedAt: timestamp('last_counted_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    unique('inventory_store_product').on(t.storeId, t.productId),
    index('inventory_product_idx').on(t.productId),
  ],
)

/**
 * The ledger. APPEND-ONLY - see D-004.
 *
 * No update, no delete, ever. A mistake is corrected by writing a compensating
 * row, which is how a business explains a discrepancy rather than hiding it.
 *
 * `quantityBefore` and `quantityAfter` are both stored even though one implies
 * the other, because it makes the chain self-verifying: if row N's `after` does
 * not equal row N+1's `before`, a write bypassed the service layer and the
 * corruption is detectable rather than silent.
 */
export const inventoryTransactions = pgTable(
  'inventory_transactions',
  {
    id: id(),
    storeId: storeId().references(() => stores.id),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),

    type: inventoryTxTypeEnum('type').notNull(),
    /** Signed. Negative for a sale, positive for a restock. */
    quantityChange: integer('quantity_change').notNull(),
    quantityBefore: integer('quantity_before').notNull(),
    quantityAfter: integer('quantity_after').notNull(),

    /** What caused it: 'order', 'stock_count', 'supplier_delivery'. */
    referenceType: text('reference_type'),
    referenceId: uuid('reference_id'),

    /** Required for manual adjustments. "Damaged in transit", "recount". */
    reason: text('reason'),

    performedBy: uuid('performed_by').references(() => users.id),
    metadata: metadata(),

    /** No updatedAt. Nothing here is ever updated. */
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('inventory_tx_product_idx').on(t.productId, t.createdAt),
    index('inventory_tx_reference_idx').on(t.referenceType, t.referenceId),
    index('inventory_tx_type_idx').on(t.storeId, t.type),
  ],
)

export const inventoryRelations = relations(inventory, ({ one }) => ({
  product: one(products, {
    fields: [inventory.productId],
    references: [products.id],
  }),
  store: one(stores, { fields: [inventory.storeId], references: [stores.id] }),
}))

export const inventoryTransactionsRelations = relations(
  inventoryTransactions,
  ({ one }) => ({
    product: one(products, {
      fields: [inventoryTransactions.productId],
      references: [products.id],
    }),
    performer: one(users, {
      fields: [inventoryTransactions.performedBy],
      references: [users.id],
    }),
  }),
)
