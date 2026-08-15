import { randomBytes } from 'node:crypto'

import { and, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { cartItems, carts, inventory, products } from '@/db/schema'
import { add, money, multiply, zero, type Money } from '@/lib/money'

/**
 * Cart service.
 *
 * Imports nothing from `next/*` — the same rule as the product service. The
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
 *    hostage is worse than the race that reserving would prevent — and the
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
 * increment rather than a second line — see the unique constraint in the
 * schema for why that matters.
 */
export async function addToCart(
  owner: CartOwner,
  productId: string,
  quantity = 1,
): Promise<CartView> {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new CartError('NOT_FOUND', 'Quantity must be a whole number of 1 or more.')
  }

  const [product] = await db
    .select({
      id: products.id,
      isActive: products.isActive,
      stockQuantity: inventory.quantity,
      stockReserved: inventory.reserved,
    })
    .from(products)
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(and(eq(products.id, productId), eq(products.storeId, STORE_ID)))

  if (!product) throw new CartError('NOT_FOUND', 'No such product.')
  if (!product.isActive) {
    throw new CartError('INACTIVE_PRODUCT', 'That product is not for sale.')
  }

  const sellable = (product.stockQuantity ?? 0) - (product.stockReserved ?? 0)
  const cartId = await resolveCart(owner)

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

  const [product] = await db
    .select({
      stockQuantity: inventory.quantity,
      stockReserved: inventory.reserved,
    })
    .from(products)
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(and(eq(products.id, productId), eq(products.storeId, STORE_ID)))

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
 * signs in to check out, watches their basket empty — which is the single most
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

  // The guest cart is removed, not left behind — otherwise the same token
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
