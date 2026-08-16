import { relations } from 'drizzle-orm'
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import { id, storeId, timestamps } from './_shared'
import { products, stores } from './catalogue'
import { users } from './identity'

/**
 * Carts.
 *
 * SERVER-SIDE, AND GUEST-FIRST. The brief is explicit: "Do NOT require account
 * creation before somebody can view the shop", and a customer must be able to
 * build a cart before signing in.
 *
 * So a cart belongs to EITHER a user or an anonymous token, never neither:
 *   - signed in  -> `userId` set, `token` null
 *   - guest      -> `token` set, `userId` null
 *
 * Held on the server rather than in localStorage for three reasons. It
 * survives a phone reload and a flat battery, which matters when the shop is
 * being used on cheap Android handsets. The API can serve it to any client,
 * which is the whole point of the boundary Codex builds against. And the shop
 * can see abandoned carts, which is real operational information.
 *
 * WHAT A CART DELIBERATELY DOES NOT DO
 *
 * It does not store prices. Line prices are read live from the product and
 * only frozen onto `order_items` at checkout. A cart that remembered a price
 * would let someone add an item, wait a week, and check out at the old figure.
 *
 * It does not reserve stock. Reservation happens at order creation. Reserving
 * at add-to-cart means one abandoned cart locks a bag of rice nobody is
 * buying, which for a grocer with thin stock is worse than the race it avoids.
 */

export const carts = pgTable(
  'carts',
  {
    id: id(),
    storeId: storeId().references(() => stores.id),

    /** Set when signed in. */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),

    /**
     * Anonymous cart token, held in a cookie. Random and unguessable - it is
     * the only thing protecting a guest's cart from anyone who knows the id.
     */
    token: text('token').unique(),

    /**
     * Carts are swept after inactivity. Nulled once converted to an order, so
     * a real order's cart is never collected.
     */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    convertedOrderId: uuid('converted_order_id'),

    ...timestamps(),
  },
  (t) => [
    index('carts_user_idx').on(t.userId),
    index('carts_token_idx').on(t.token),
    index('carts_expiry_idx').on(t.expiresAt),
  ],
)

export const cartItems = pgTable(
  'cart_items',
  {
    id: id(),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    quantity: integer('quantity').notNull(),
    ...timestamps(),
  },
  (t) => [
    // One row per product per cart. Adding the same item again increments the
    // quantity rather than creating a second line - otherwise a cart shows
    // "Rice x1, Rice x1" and the totals still work, which is worse than an
    // error because nobody notices.
    unique('cart_items_cart_product').on(t.cartId, t.productId),
    index('cart_items_cart_idx').on(t.cartId),
  ],
)

export const cartsRelations = relations(carts, ({ one, many }) => ({
  store: one(stores, { fields: [carts.storeId], references: [stores.id] }),
  user: one(users, { fields: [carts.userId], references: [users.id] }),
  items: many(cartItems),
}))

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
}))
