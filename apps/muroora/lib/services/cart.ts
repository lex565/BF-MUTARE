import { randomBytes } from 'node:crypto'

import { and, eq, isNull, ne, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { businesses, cartItems, carts, inventory, products } from '@/db/schema'
import { add, money, multiply, zero, type Money } from '@/lib/money'

/**
 * Cart service.
 *
 * Imports nothing from `next/*` - the same rule as the product service. The
 * caller supplies who the cart belongs to; this file does not know or care
 * whether it was reached from a web page, a route handler, or a native app.
 *
 * TWO THINGS THIS DELIBERATELY DOES NOT DO
 *
 * 1. It does not store prices. Line totals are computed live from the product
 *    on every read, and the price is only frozen onto `order_items` at
 *    checkout. A cart that remembered a price would let someone add an item,
 *    wait a fortnight, and check out at the old figure.
 *
 * 2. It does not reserve stock. Reservation happens at order creation. For a
 *    grocer with thin stock, an abandoned cart holding the last bag of rice
 *    hostage is worse than the race that reserving would prevent - and the
 *    race is handled properly at checkout, under a row lock.
 *
 * Availability IS checked when adding, so a customer is told immediately
 * rather than at the till. That check is advisory; checkout re-checks it for
 * real.
 */

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID!

/** Guest carts live 30 days from last touch. Long enough to come back to. */
const GUEST_CART_DAYS = 30

/* ------------------------------------------------------------------ types */

export interface CartLine {
  itemId: string
  productId: string
  name: string
  slug: string
  unitSize: string | null
  quantity: number
  unitPrice: Money
  lineTotal: Money
  /** True when the shop no longer has enough. The line is kept, not dropped. */
  exceedsStock: boolean
  sellable: number
  availability: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'
}

export interface CartView {
  id: string
  lines: CartLine[]
  itemCount: number
  subtotal: Money
  /** Any line the shop cannot currently fulfil. Checkout must refuse these. */
  hasProblems: boolean
}

/** Identifies whose cart to act on. Exactly one field is set. */
export type CartOwner =
  | { userId: string; token?: undefined }
  | { token: string; userId?: undefined }

export class CartError extends Error {
  constructor(
    readonly code: 'NOT_FOUND' | 'INSUFFICIENT_STOCK' | 'INACTIVE_PRODUCT',
    message: string,
  ) {
    super(message)
    this.name = 'CartError'
  }
}

/* -------------------------------------------------------------- internals */

export const newCartToken = (): string => randomBytes(24).toString('base64url')

const expiryFromNow = (): Date =>
  new Date(Date.now() + GUEST_CART_DAYS * 24 * 60 * 60 * 1000)

/**
 * Find or create the cart for this owner.
 *
 * `onConflictDoNothing` plus a re-select rather than a check-then-insert: two
 * simultaneous "add to cart" taps from one impatient customer would otherwise
 * both see no cart and both try to create one.
 */
async function resolveCart(owner: CartOwner): Promise<string> {
  const where =
    owner.userId !== undefined
      ? and(eq(carts.userId, owner.userId), isNull(carts.convertedOrderId))
      : and(eq(carts.token, owner.token!), isNull(carts.convertedOrderId))

  const [existing] = await db.select({ id: carts.id }).from(carts).where(where)
  if (existing) return existing.id

  const [created] = await db
    .insert(carts)
    .values({
      storeId: STORE_ID,
      userId: owner.userId ?? null,
      token: owner.token ?? null,
      expiresAt: owner.userId ? null : expiryFromNow(),
    })
    .onConflictDoNothing()
    .returning({ id: carts.id })

  if (created) return created.id

  const [raced] = await db.select({ id: carts.id }).from(carts).where(where)
  if (!raced) throw new CartError('NOT_FOUND', 'Could not open a cart.')
  return raced.id
}

/* ------------------------------------------------------------------ reads */

/** The cart, priced live. Returns an empty cart rather than throwing. */
export async function getCart(owner: CartOwner): Promise<CartView> {
  const cartId = await resolveCart(owner)

  const rows = await db
    .select({
      itemId: cartItems.id,
      productId: products.id,
      name: products.name,
      slug: products.slug,
      unitSize: products.unitSize,
      quantity: cartItems.quantity,
      priceAmount: products.priceAmount,
      promoPriceAmount: products.promoPriceAmount,
      lowStockThreshold: products.lowStockThreshold,
      isActive: products.isActive,
      stockQuantity: inventory.quantity,
      stockReserved: inventory.reserved,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(eq(cartItems.cartId, cartId))

  const lines: CartLine[] = rows
    // A product withdrawn since it was added is dropped from the view rather
    // than shown as unbuyable. It is still in the table, so if the shop puts
    // it back the customer's cart is intact.
    .filter((row) => row.isActive)
    .map((row) => {
      const unitPrice = money(
        row.promoPriceAmount ?? row.priceAmount,
        'USD',
      )
      const sellable = (row.stockQuantity ?? 0) - (row.stockReserved ?? 0)

      return {
        itemId: row.itemId,
        productId: row.productId,
        name: row.name,
        slug: row.slug,
        unitSize: row.unitSize,
        quantity: row.quantity,
        unitPrice,
        lineTotal: multiply(unitPrice, row.quantity),
        exceedsStock: row.quantity > sellable,
        sellable: Math.max(0, sellable),
        availability:
          sellable <= 0
            ? 'OUT_OF_STOCK'
            : sellable <= row.lowStockThreshold
              ? 'LOW_STOCK'
              : 'IN_STOCK',
      }
    })

  return {
    id: cartId,
    lines,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal: lines.reduce((total, l) => add(total, l.lineTotal), zero('USD')),
    hasProblems: lines.some((l) => l.exceedsStock),
  }
}

/* ----------------------------------------------------------------- writes */

/**
 * Add to the cart, or increase an existing line.
 *
 * `onConflictDoUpdate` on (cart, product) makes "add the same thing twice" an
 * increment rather than a second line - see the unique constraint in the
 * schema for why that matters.
 */

/**
 * Is this product something a customer may actually buy on Musuwo right now?
 *
 * THE BUG THIS REPLACED. Both cart paths filtered on
 * `eq(products.storeId, STORE_ID)` - one hard-coded store, read from
 * NEXT_PUBLIC_STORE_ID, which is Muroora Mart's. So a customer could browse
 * The Pant and Perfume Shop, open Cotton pants, press Add to basket, and get
 * "No such product." Not out of stock, not unavailable: the cart genuinely
 * could not see any merchant except the founding one. Every marketplace
 * merchant was browse-only and nothing said so.
 *
 * The conditions below are the SAME FOUR the marketplace itself publishes
 * under - active, not deleted, published to Musuwo, business publicly visible -
 * plus the merchant's own shop for Muroora, whose products are sold directly
 * and are not all published to the marketplace. Sharing the predicate is the
 * point: a product a customer can see is a product a customer can buy, and
 * suspending a merchant removes both at once.
 */
async function purchasable(productId: string) {
  const [row] = await db
    .select({
      id: products.id,
      storeId: products.storeId,
      isActive: products.isActive,
      deletedAt: products.deletedAt,
      publishToMusuwo: products.publishToMusuwo,
      businessId: businesses.id,
      businessName: businesses.name,
      businessStatus: businesses.status,
      businessDeletedAt: businesses.deletedAt,
      stockQuantity: inventory.quantity,
      stockReserved: inventory.reserved,
    })
    .from(products)
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .leftJoin(businesses, eq(businesses.storeId, products.storeId))
    .where(eq(products.id, productId))

  if (!row || row.deletedAt !== null) return null

  const isOwnStore = row.storeId === STORE_ID
  const businessIsPublic =
    row.businessStatus !== null &&
    ['ACTIVE', 'PILOT'].includes(row.businessStatus) &&
    row.businessDeletedAt === null

  // Muroora's own shop sells its whole active catalogue. Everybody else sells
  // only what they deliberately published to the marketplace.
  if (!isOwnStore && !(row.publishToMusuwo && businessIsPublic)) return null

  return row
}

/**
 * One merchant per basket.
 *
 * Not a limitation invented here - it is what the rest of the platform already
 * assumes. `carts.store_id`, `orders.store_id` and every delivery zone are
 * per-store, so a basket holding two merchants' goods cannot become one order
 * or one delivery without changes running through checkout, orders, zones and
 * the rider flow. The mobile app's own copy already says "one merchant per
 * checkout".
 *
 * So the rule is enforced here and explained to the customer, rather than
 * being discovered at checkout when it is too late to do anything about it.
 */
async function differentMerchantInCart(
  cartId: string,
  storeId: string,
): Promise<string | null> {
  const [clash] = await db
    .select({ name: businesses.name })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .leftJoin(businesses, eq(businesses.storeId, products.storeId))
    .where(and(eq(cartItems.cartId, cartId), ne(products.storeId, storeId)))
    .limit(1)

  return clash ? (clash.name ?? 'another shop') : null
}

export async function addToCart(
  owner: CartOwner,
  productId: string,
  quantity = 1,
): Promise<CartView> {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new CartError('NOT_FOUND', 'Quantity must be a whole number of 1 or more.')
  }

  const product = await purchasable(productId)

  if (!product) throw new CartError('NOT_FOUND', 'No such product.')
  if (!product.isActive) {
    throw new CartError('INACTIVE_PRODUCT', 'That product is not for sale.')
  }

  const sellable = (product.stockQuantity ?? 0) - (product.stockReserved ?? 0)
  const cartId = await resolveCart(owner)

  const clash = await differentMerchantInCart(cartId, product.storeId)
  if (clash) {
    throw new CartError(
      'INACTIVE_PRODUCT',
      `Your basket already has items from ${clash}. Musuwo delivers one shop at a time, so please finish that order first or empty the basket.`,
    )
  }

  const [alreadyInCart] = await db
    .select({ quantity: cartItems.quantity })
    .from(cartItems)
    .where(
      and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)),
    )

  const wanted = (alreadyInCart?.quantity ?? 0) + quantity
  if (wanted > sellable) {
    throw new CartError(
      'INSUFFICIENT_STOCK',
      sellable === 0
        ? 'That is out of stock.'
        : `Only ${sellable} left, and you already have ${alreadyInCart?.quantity ?? 0} in your cart.`,
    )
  }

  await db
    .insert(cartItems)
    .values({ cartId, productId, quantity })
    .onConflictDoUpdate({
      target: [cartItems.cartId, cartItems.productId],
      set: {
        quantity: sql`${cartItems.quantity} + ${quantity}`,
        updatedAt: new Date(),
      },
    })

  await touchCart(cartId)
  return getCart(owner)
}

/** Set an exact quantity. Zero removes the line. */
export async function setCartQuantity(
  owner: CartOwner,
  productId: string,
  quantity: number,
): Promise<CartView> {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new CartError('NOT_FOUND', 'Quantity must be zero or a whole number.')
  }

  const cartId = await resolveCart(owner)

  if (quantity === 0) {
    await db
      .delete(cartItems)
      .where(
        and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)),
      )
    await touchCart(cartId)
    return getCart(owner)
  }

  // Same predicate as adding. If these two disagreed, a customer could add an
  // item and then be unable to change its quantity.
  const product = await purchasable(productId)

  if (!product) throw new CartError('NOT_FOUND', 'No such product.')

  const sellable = (product.stockQuantity ?? 0) - (product.stockReserved ?? 0)
  if (quantity > sellable) {
    throw new CartError(
      'INSUFFICIENT_STOCK',
      sellable === 0 ? 'That is out of stock.' : `Only ${sellable} left.`,
    )
  }

  await db
    .update(cartItems)
    .set({ quantity, updatedAt: new Date() })
    .where(
      and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)),
    )

  await touchCart(cartId)
  return getCart(owner)
}

export async function removeFromCart(
  owner: CartOwner,
  productId: string,
): Promise<CartView> {
  return setCartQuantity(owner, productId, 0)
}

export async function clearCart(owner: CartOwner): Promise<CartView> {
  const cartId = await resolveCart(owner)
  await db.delete(cartItems).where(eq(cartItems.cartId, cartId))
  await touchCart(cartId)
  return getCart(owner)
}

/**
 * Merge a guest cart into an account's cart at sign-in.
 *
 * Called after a successful login. Without it, somebody who fills a cart, then
 * signs in to check out, watches their basket empty - which is the single most
 * effective way to lose a sale.
 *
 * Quantities are ADDED, and capped at what is actually sellable. If the same
 * item is in both carts the customer wanted it, not one of it.
 */
export async function mergeGuestCart(
  token: string,
  userId: string,
): Promise<void> {
  const [guest] = await db
    .select({ id: carts.id })
    .from(carts)
    .where(and(eq(carts.token, token), isNull(carts.convertedOrderId)))

  if (!guest) return

  const guestLines = await db
    .select({
      productId: cartItems.productId,
      quantity: cartItems.quantity,
    })
    .from(cartItems)
    .where(eq(cartItems.cartId, guest.id))

  if (guestLines.length > 0) {
    const userCartId = await resolveCart({ userId })

    for (const line of guestLines) {
      const [stock] = await db
        .select({
          quantity: inventory.quantity,
          reserved: inventory.reserved,
        })
        .from(inventory)
        .where(eq(inventory.productId, line.productId))

      const sellable = (stock?.quantity ?? 0) - (stock?.reserved ?? 0)
      if (sellable <= 0) continue

      await db
        .insert(cartItems)
        .values({
          cartId: userCartId,
          productId: line.productId,
          quantity: Math.min(line.quantity, sellable),
        })
        .onConflictDoUpdate({
          target: [cartItems.cartId, cartItems.productId],
          set: {
            quantity: sql`least(${cartItems.quantity} + ${line.quantity}, ${sellable})`,
            updatedAt: new Date(),
          },
        })
    }
  }

  // The guest cart is removed, not left behind - otherwise the same token
  // would resurrect it on the next anonymous visit from that browser.
  await db.delete(carts).where(eq(carts.id, guest.id))
}

/** Push the expiry out. A cart in use is not abandoned. */
async function touchCart(cartId: string): Promise<void> {
  await db
    .update(carts)
    .set({ updatedAt: new Date(), expiresAt: expiryFromNow() })
    .where(and(eq(carts.id, cartId), isNull(carts.userId)))
}
