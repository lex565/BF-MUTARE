import { createHash } from 'node:crypto'

import { and, desc, eq, sql } from 'drizzle-orm'

import { db, type DbOrTx } from '@/db/client'
import {
  cartItems,
  carts,
  idempotencyKeys,
  inventory,
  orderEvents,
  orderItems,
  orders,
  products,
} from '@/db/schema'
import { InsufficientStockError, reserveStock } from '@/lib/inventory'
import { add, money, multiply, zero, type Money } from '@/lib/money'
import { quoteDelivery, DeliveryError } from '@/lib/services/delivery'
import type { CartOwner } from '@/lib/services/cart'

/**
 * Order creation.
 *
 * This is the one place in the system where a cart becomes a commitment, and
 * it is written to hold four things true at once:
 *
 * 1. PRICES ARE FROZEN HERE, AND ONLY HERE. The cart prices live; the order
 *    copies name, size and unit price onto `order_items`. A price rise next
 *    week must not rewrite what a customer was charged today.
 *
 * 2. STOCK IS RESERVED IN THE SAME TRANSACTION. Reservation goes through
 *    lib/inventory.ts under a row lock, so two customers cannot both buy the
 *    last bag of rice. If any line fails, the whole order rolls back - there is
 *    no such thing as a half-placed order.
 *
 * 3. THE ORDER IS IDEMPOTENT. A customer on a bad connection who taps "Place
 *    order" twice gets one order and one reservation. The second tap replays
 *    the first answer.
 *
 * 4. STATUS IS A PROJECTION. Every change writes `order_events` first and then
 *    updates `orders.status` to match. Nothing sets the status column directly,
 *    which is what makes "who cancelled this and when" answerable.
 *
 * Imports nothing from `next/*`. A native app calling the HTTP route gets
 * exactly the behaviour a server component gets.
 */

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID!

/** How long a repeated checkout is treated as the same attempt. */
const IDEMPOTENCY_HOURS = 24

/* ------------------------------------------------------------------ types */

export interface RecipientDetails {
  name: string
  phone: string
  relationship?: string
  line1: string
  line2?: string
  suburb: string
  city?: string
  directions?: string
  alternativeContactName?: string
  alternativeContactPhone?: string
}

export interface BuyerDetails {
  name: string
  email?: string
  phone?: string
  countryCode?: string
}

export interface PlaceOrderInput {
  owner: CartOwner
  buyer: BuyerDetails
  recipient: RecipientDetails
  /** Client-generated. The same value on a retry means "the same attempt". */
  idempotencyKey: string
  substitutionPreference?: 'NONE' | 'SIMILAR' | 'CONTACT_ME'
  customerNote?: string
  /** Set when a signed-in account is placing it. Guests pass nothing. */
  userId?: string
}

export interface PlacedOrder {
  id: string
  orderNumber: string
  status: string
  subtotal: Money
  deliveryFee: Money
  total: Money
  currency: 'USD' | 'ZWL'
  itemCount: number
  recipientName: string
  deliverySuburb: string
  zoneName: string
  estimatedMinutesMin: number | null
  estimatedMinutesMax: number | null
  placedAt: Date
  /** True when this was a replay of an earlier identical request. */
  replayed: boolean
}

export class OrderError extends Error {
  constructor(
    readonly code:
      | 'EMPTY_CART'
      | 'STOCK_CHANGED'
      | 'NO_DELIVERY'
      | 'BELOW_MINIMUM'
      | 'INVALID_DETAILS'
      | 'NOT_FOUND'
      | 'ILLEGAL_TRANSITION',
    message: string,
    readonly detail?: unknown,
  ) {
    super(message)
    this.name = 'OrderError'
  }
}

/* ------------------------------------------------------------- validation */

/**
 * Zimbabwean mobile numbers, loosely.
 *
 * Accepts +263771234567, 0771234567 and 263771234567. Deliberately not
 * strict about the operator prefix - a rule that rejects a real number
 * because a new prefix was issued last month is worse than one that lets an
 * odd number through to a human who will phone it anyway.
 */
export function normalisePhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, '')
  if (digits.startsWith('+263')) return digits
  if (digits.startsWith('263')) return `+${digits}`
  if (digits.startsWith('0')) return `+263${digits.slice(1)}`
  return digits
}

const isPlausiblePhone = (e164: string): boolean =>
  /^\+\d{9,15}$/.test(e164)

function validate(input: PlaceOrderInput): void {
  const problems: string[] = []

  if (!input.buyer.name?.trim()) problems.push('the buyer needs a name')
  if (!input.recipient.name?.trim()) problems.push('the recipient needs a name')
  if (!input.recipient.line1?.trim()) {
    problems.push('the delivery address needs a street or house number')
  }
  if (!input.recipient.suburb?.trim()) {
    problems.push('the delivery address needs a suburb')
  }

  const phone = normalisePhone(input.recipient.phone ?? '')
  if (!isPlausiblePhone(phone)) {
    // The recipient's phone is the one field a failed delivery depends on.
    // A rider outside a locked gate with no number to ring is a wasted trip.
    problems.push("the recipient's phone number does not look complete")
  }

  if (!input.idempotencyKey?.trim()) {
    problems.push('a request key is missing')
  }

  if (problems.length > 0) {
    throw new OrderError(
      'INVALID_DETAILS',
      `Please check ${problems.join(', ')}.`,
      problems,
    )
  }
}

/* ------------------------------------------------------------ idempotency */

/**
 * The idempotency key is scoped and hashed with the cart owner.
 *
 * Without the owner in the hash, one client's key could collide with another's
 * and replay somebody else's order back to them. The hash also means a client
 * key of any shape fits the column.
 */
const scopedKey = (rawKey: string, owner: CartOwner): string =>
  createHash('sha256')
    .update(`checkout:${owner.userId ?? owner.token}:${rawKey}`)
    .digest('hex')

/* ------------------------------------------------------------ order events */

/**
 * Record a change and move the status to match.
 *
 * ALWAYS use this. Writing `orders.status` directly is what the append-only
 * event log exists to prevent - the column is a cache of the last event, and
 * a status with no event behind it is a change nobody can attribute.
 */
export async function recordOrderEvent(
  params: {
    orderId: string
    eventType: string
    newStatus?: (typeof orders.$inferSelect)['status']
    actorType: 'CUSTOMER' | 'STAFF' | 'ADMIN' | 'RIDER' | 'SYSTEM'
    actorId?: string
    metadata?: Record<string, unknown>
  },
  tx?: DbOrTx,
): Promise<void> {
  const run = async (conn: DbOrTx) => {
    const [order] = await conn
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, params.orderId))

    if (!order) throw new OrderError('NOT_FOUND', 'No such order.')

    await conn.insert(orderEvents).values({
      orderId: params.orderId,
      eventType: params.eventType,
      previousStatus: order.status,
      newStatus: params.newStatus ?? order.status,
      actorType: params.actorType,
      actorId: params.actorId ?? null,
      metadata: params.metadata ?? null,
    })

    if (params.newStatus && params.newStatus !== order.status) {
      await conn
        .update(orders)
        .set({ status: params.newStatus, updatedAt: new Date() })
        .where(eq(orders.id, params.orderId))
    }
  }

  return tx ? run(tx) : db.transaction(run)
}

/* -------------------------------------------------------------- the order */

/**
 * Turn a cart into an order.
 *
 * Everything below happens in one database transaction: the order row, its
 * lines, the stock reservations, the first event, and marking the cart
 * converted. A failure at any point leaves the shop exactly as it was.
 */
export async function placeOrder(
  input: PlaceOrderInput,
): Promise<PlacedOrder> {
  validate(input)

  const key = scopedKey(input.idempotencyKey, input.owner)

  // Replay first, before touching anything. A retry must not even look at
  // stock - the answer was decided the first time.
  const [seen] = await db
    .select()
    .from(idempotencyKeys)
    .where(eq(idempotencyKeys.key, key))

  if (seen?.response) {
    const replayed = JSON.parse(seen.response) as PlacedOrder
    return {
      ...replayed,
      subtotal: money(BigInt(replayed.subtotal.amount), replayed.currency),
      deliveryFee: money(BigInt(replayed.deliveryFee.amount), replayed.currency),
      total: money(BigInt(replayed.total.amount), replayed.currency),
      placedAt: new Date(replayed.placedAt),
      replayed: true,
    }
  }

  /* ---- Read the cart and price it, OUTSIDE the transaction ------------- */

  const where =
    input.owner.userId !== undefined
      ? and(eq(carts.userId, input.owner.userId), sql`${carts.convertedOrderId} is null`)
      : and(eq(carts.token, input.owner.token!), sql`${carts.convertedOrderId} is null`)

  const [cart] = await db.select({ id: carts.id }).from(carts).where(where)
  if (!cart) throw new OrderError('EMPTY_CART', 'There is nothing in your cart.')

  const lines = await db
    .select({
      productId: products.id,
      name: products.name,
      sku: products.sku,
      unitSize: products.unitSize,
      quantity: cartItems.quantity,
      priceAmount: products.priceAmount,
      promoPriceAmount: products.promoPriceAmount,
      isActive: products.isActive,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.cartId, cart.id))

  const sellable = lines.filter((l) => l.isActive)
  if (sellable.length === 0) {
    throw new OrderError('EMPTY_CART', 'There is nothing in your cart.')
  }

  const withdrawn = lines.filter((l) => !l.isActive)
  if (withdrawn.length > 0) {
    throw new OrderError(
      'STOCK_CHANGED',
      `${withdrawn.map((w) => w.name).join(' and ')} ${
        withdrawn.length === 1 ? 'is' : 'are'
      } no longer for sale. Please remove ${
        withdrawn.length === 1 ? 'it' : 'them'
      } from your cart.`,
      withdrawn.map((w) => w.productId),
    )
  }

  const priced = sellable.map((line) => {
    const unitPrice = money(line.promoPriceAmount ?? line.priceAmount, 'USD')
    return { ...line, unitPrice, lineTotal: multiply(unitPrice, line.quantity) }
  })

  const subtotal = priced.reduce(
    (total, l) => add(total, l.lineTotal),
    zero('USD'),
  )

  /* ---- Delivery, quoted once and then stored ---------------------------- */

  let quote
  try {
    quote = await quoteDelivery({
      suburb: input.recipient.suburb,
      subtotal,
    })
  } catch (error) {
    if (error instanceof DeliveryError) {
      throw new OrderError('NO_DELIVERY', error.message)
    }
    throw error
  }

  if (quote.belowMinimum) {
    throw new OrderError(
      'BELOW_MINIMUM',
      `Deliveries to ${quote.zone.name} start at ` +
        `${quote.zone.minimumOrder.currency} ` +
        `${(Number(quote.zone.minimumOrder.amount) / 100).toFixed(2)}. ` +
        `Your basket is short by ` +
        `${(Number(quote.shortfall!.amount) / 100).toFixed(2)}.`,
    )
  }

  const total = add(subtotal, quote.fee)

  /* ---- One transaction: order, lines, stock, event, cart --------------- */

  const placed = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        storeId: STORE_ID,
        buyerId: input.userId ?? null,
        buyerName: input.buyer.name.trim(),
        buyerEmail: input.buyer.email?.trim() || null,
        buyerPhone: input.buyer.phone
          ? normalisePhone(input.buyer.phone)
          : null,
        buyerCountryCode: input.buyer.countryCode?.trim() || null,

        recipientName: input.recipient.name.trim(),
        recipientPhone: normalisePhone(input.recipient.phone),
        recipientRelationship: input.recipient.relationship?.trim() || null,
        deliveryLine1: input.recipient.line1.trim(),
        deliveryLine2: input.recipient.line2?.trim() || null,
        deliverySuburb: input.recipient.suburb.trim(),
        deliveryCity: input.recipient.city?.trim() || 'Mutare',
        deliveryDirections: input.recipient.directions?.trim() || null,
        alternativeContactName:
          input.recipient.alternativeContactName?.trim() || null,
        alternativeContactPhone: input.recipient.alternativeContactPhone
          ? normalisePhone(input.recipient.alternativeContactPhone)
          : null,

        currency: 'USD',
        subtotalAmount: subtotal.amount,
        deliveryFeeAmount: quote.fee.amount,
        totalAmount: total.amount,

        // DRAFT would be wrong: the customer has committed. Payment has not
        // happened, and no provider exists yet, so PENDING_PAYMENT is the
        // honest state - see the payments table note.
        status: 'PENDING_PAYMENT',
        substitutionPreference: input.substitutionPreference ?? 'CONTACT_ME',
        customerNote: input.customerNote?.trim() || null,
        zoneId: quote.zone.id,
        placedAt: new Date(),
        // orderNumber omitted: the column default calls next_order_number(),
        // which is atomic.
      } as never)
      .returning()

    await tx.insert(orderItems).values(
      priced.map((line) => ({
        orderId: order.id,
        productId: line.productId,
        productName: line.name,
        productSku: line.sku,
        unitSize: line.unitSize,
        quantity: line.quantity,
        unitPriceAmount: line.unitPrice.amount,
        lineTotalAmount: line.lineTotal.amount,
      })),
    )

    // Reserve every line. Under a row lock, in this same transaction - so if
    // the last bag of rice went to somebody else two seconds ago, this whole
    // order disappears rather than being accepted and quietly short.
    for (const line of priced) {
      try {
        await reserveStock(
          {
            storeId: STORE_ID,
            productId: line.productId,
            quantity: line.quantity,
            orderId: order.id,
            performedBy: input.userId,
          },
          tx,
        )
      } catch (error) {
        if (error instanceof InsufficientStockError) {
          throw new OrderError(
            'STOCK_CHANGED',
            `Somebody just took the last of the ${line.name}. ` +
              `${error.available === 0 ? 'It is now out of stock' : `Only ${error.available} left`}. ` +
              `Nothing has been ordered - please adjust your cart and try again.`,
            { productId: line.productId, available: error.available },
          )
        }
        throw error
      }
    }

    await tx.insert(orderEvents).values({
      orderId: order.id,
      eventType: 'ORDER_PLACED',
      previousStatus: null,
      newStatus: 'PENDING_PAYMENT',
      actorType: 'CUSTOMER',
      actorId: input.userId ?? null,
      metadata: {
        itemCount: priced.reduce((n, l) => n + l.quantity, 0),
        zone: quote.zone.name,
        guest: input.userId ? false : true,
      },
    })

    // The cart is marked converted rather than deleted, so the customer's
    // order history can point back at exactly what they had chosen.
    await tx
      .update(carts)
      .set({ convertedOrderId: order.id, updatedAt: new Date() })
      .where(eq(carts.id, cart.id))

    return order
  })

  const result: PlacedOrder = {
    id: placed.id,
    orderNumber: placed.orderNumber,
    status: placed.status,
    subtotal,
    deliveryFee: quote.fee,
    total,
    currency: 'USD',
    itemCount: priced.reduce((n, l) => n + l.quantity, 0),
    recipientName: placed.recipientName,
    deliverySuburb: placed.deliverySuburb,
    zoneName: quote.zone.name,
    estimatedMinutesMin: quote.zone.estimatedMinutesMin,
    estimatedMinutesMax: quote.zone.estimatedMinutesMax,
    placedAt: placed.placedAt!,
    replayed: false,
  }

  // Stored AFTER the order commits. Storing it first would mean a crash
  // mid-transaction left a key claiming an order that does not exist, and the
  // customer's retry would be answered with a phantom.
  await db
    .insert(idempotencyKeys)
    .values({
      key,
      scope: 'checkout',
      userId: input.userId ?? null,
      response: JSON.stringify({
        ...result,
        subtotal: { amount: result.subtotal.amount.toString(), currency: 'USD' },
        deliveryFee: {
          amount: result.deliveryFee.amount.toString(),
          currency: 'USD',
        },
        total: { amount: result.total.amount.toString(), currency: 'USD' },
      }),
      expiresAt: new Date(Date.now() + IDEMPOTENCY_HOURS * 60 * 60 * 1000),
    })
    .onConflictDoNothing()

  return result
}

/* ------------------------------------------------------------------ reads */

export interface OrderSummary {
  id: string
  orderNumber: string
  status: string
  placedAt: Date | null
  recipientName: string
  deliverySuburb: string
  itemCount: number
  total: Money
}

/**
 * The six states a customer should see.
 *
 * The brief: "Do not force every status into the customer UI." A customer does
 * not need to know the difference between PACKED and READY_FOR_PICKUP; they
 * need to know whether somebody is packing their shopping.
 */
export function customerFacingStatus(status: string): {
  label: string
  blurb: string
  /**
   * Who is carrying it, said quietly and only once it is moving.
   *
   * THE ARRANGEMENT, AND WHY THE WORDING MATTERS. A customer bought from the
   * merchant - Muroora Mart, or whoever - and that is the name they should see
   * throughout: on the site, on the receipt, at the top of this screen.
   * Musuwo is the layer underneath that collects the order and gets it to
   * them.
   *
   * So the merchant's name leads and this is secondary, and it appears only
   * while the order is actually in transit. Putting "Musuwo" beside "Being
   * packed" would be telling somebody about a company they did not buy from,
   * at a moment it makes no difference to them.
   */
  carrier?: string
} {
  switch (status) {
    case 'DRAFT':
    case 'PENDING_PAYMENT':
      return {
        label: 'Awaiting payment',
        blurb: 'We have your order and are waiting for payment to clear.',
      }
    case 'PAYMENT_CONFIRMED':
    case 'ORDER_RECEIVED':
    case 'ACCEPTED':
      return {
        label: 'Received',
        blurb: 'The shop has your order and will start picking it shortly.',
      }
    case 'PICKING':
    case 'AWAITING_SUBSTITUTION_APPROVAL':
    case 'PACKED':
    case 'READY_FOR_PICKUP':
      return {
        label: 'Being packed',
        blurb: 'Somebody is putting your shopping together now.',
      }
    case 'DRIVER_ASSIGNED':
    case 'RIDER_AT_STORE':
    case 'COLLECTED':
    case 'OUT_FOR_DELIVERY':
    case 'RIDER_ARRIVED':
      return {
        label: 'On the way',
        blurb: 'Your order has left the shop.',
        carrier: 'Delivery coordinated by Musuwo',
      }
    case 'DELIVERED':
      return { label: 'Delivered', blurb: 'Delivered. Thank you.' }
    case 'DELIVERY_FAILED':
      return {
        label: 'Could not deliver',
        blurb: 'We could not complete the delivery. The shop will be in touch.',
        carrier: 'Delivery coordinated by Musuwo',
      }
    case 'CANCELLED':
      return { label: 'Cancelled', blurb: 'This order was cancelled.' }
    case 'REFUNDED':
    case 'PARTIALLY_REFUNDED':
      return { label: 'Refunded', blurb: 'A refund has been recorded.' }
    default:
      return { label: status, blurb: '' }
  }
}

/** A buyer's own orders. */
export async function listOrdersForUser(
  userId: string,
): Promise<OrderSummary[]> {
  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      placedAt: orders.placedAt,
      recipientName: orders.recipientName,
      deliverySuburb: orders.deliverySuburb,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      itemCount: sql<number>`(
        select coalesce(sum(quantity), 0)::int from order_items
        where order_items.order_id = ${orders.id}
      )`,
    })
    .from(orders)
    .where(and(eq(orders.buyerId, userId), eq(orders.storeId, STORE_ID)))
    .orderBy(desc(orders.placedAt))

  return rows.map((r) => ({
    ...r,
    total: money(r.totalAmount, r.currency),
  }))
}

/**
 * One order in full, with its lines and its history.
 *
 * `requireBuyerId` is not optional by accident: an order is looked up by a
 * short human number that appears in WhatsApp messages, so anyone who guesses
 * MM-000004 must not be handed somebody else's address and phone number. Staff
 * screens pass null deliberately, after their own role check.
 */
export async function getOrder(params: {
  orderNumber: string
  requireBuyerId: string | null
}) {
  const [order] = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.orderNumber, params.orderNumber),
        eq(orders.storeId, STORE_ID),
      ),
    )

  if (!order) return null
  if (params.requireBuyerId && order.buyerId !== params.requireBuyerId) {
    return null
  }

  const [items, events] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, order.id))
      .orderBy(orderEvents.createdAt),
  ])

  return {
    ...order,
    subtotal: money(order.subtotalAmount, order.currency),
    deliveryFee: money(order.deliveryFeeAmount, order.currency),
    total: money(order.totalAmount, order.currency),
    customerStatus: customerFacingStatus(order.status),
    items: items.map((i) => ({
      ...i,
      unitPrice: money(i.unitPriceAmount, order.currency),
      lineTotal: money(i.lineTotalAmount, order.currency),
    })),
    events,
  }
}

/* ------------------------------------------------------------ cancellation */

/**
 * Statuses a customer may still cancel from.
 *
 * Once staff have started picking, cancelling is a conversation, not a button:
 * somebody is standing in an aisle with a trolley. The shop can still cancel
 * from any state.
 */
const CUSTOMER_CANCELLABLE = new Set([
  'DRAFT',
  'PENDING_PAYMENT',
  'PAYMENT_CONFIRMED',
  'ORDER_RECEIVED',
  'ACCEPTED',
])

/**
 * Cancel an order and put the stock back.
 *
 * The reservation is released in the same transaction as the status change,
 * so a cancelled order can never leave stock held against it - that is the
 * failure that slowly makes a shop look empty while the shelves are full.
 */
export async function cancelOrder(params: {
  orderId: string
  reason: string
  actorType: 'CUSTOMER' | 'STAFF' | 'ADMIN' | 'SYSTEM'
  actorId?: string
}): Promise<void> {
  if (!params.reason?.trim()) {
    throw new OrderError('INVALID_DETAILS', 'A cancellation needs a reason.')
  }

  await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, params.orderId))

    if (!order) throw new OrderError('NOT_FOUND', 'No such order.')

    if (order.status === 'CANCELLED') return

    if (
      params.actorType === 'CUSTOMER' &&
      !CUSTOMER_CANCELLABLE.has(order.status)
    ) {
      throw new OrderError(
        'ILLEGAL_TRANSITION',
        'This order is already being packed. Please phone the shop - ' +
          'somebody is picking it right now.',
      )
    }

    if (['DELIVERED', 'REFUNDED'].includes(order.status)) {
      throw new OrderError(
        'ILLEGAL_TRANSITION',
        'This order has already been delivered. It needs a refund, not a ' +
          'cancellation, so the money is recorded properly.',
      )
    }

    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id))

    for (const item of items) {
      if (!item.productId) continue
      const [row] = await tx
        .select()
        .from(inventory)
        .where(
          and(
            eq(inventory.storeId, order.storeId),
            eq(inventory.productId, item.productId),
          ),
        )
        .for('update')

      if (!row) continue

      await tx
        .update(inventory)
        .set({
          reserved: Math.max(0, row.reserved - item.quantity),
          updatedAt: new Date(),
        })
        .where(eq(inventory.id, row.id))
    }

    await tx.insert(orderEvents).values({
      orderId: order.id,
      eventType: 'ORDER_CANCELLED',
      previousStatus: order.status,
      newStatus: 'CANCELLED',
      actorType: params.actorType,
      actorId: params.actorId ?? null,
      metadata: { reason: params.reason.trim(), linesReleased: items.length },
    })

    await tx
      .update(orders)
      .set({ status: 'CANCELLED', updatedAt: new Date() })
      .where(eq(orders.id, order.id))
  })
}

/* ------------------------------------------------------------ staff queue */

/** The queue a staff member works from. Newest commitment first. */
export async function listOrdersForStaff(
  statuses?: string[],
): Promise<OrderSummary[]> {
  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      placedAt: orders.placedAt,
      recipientName: orders.recipientName,
      deliverySuburb: orders.deliverySuburb,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      itemCount: sql<number>`(
        select coalesce(sum(quantity), 0)::int from order_items
        where order_items.order_id = ${orders.id}
      )`,
    })
    .from(orders)
    .where(
      statuses && statuses.length > 0
        ? and(
            eq(orders.storeId, STORE_ID),
            sql`${orders.status}::text = any(${statuses})`,
          )
        : eq(orders.storeId, STORE_ID),
    )
    .orderBy(desc(orders.placedAt))

  return rows.map((r) => ({ ...r, total: money(r.totalAmount, r.currency) }))
}

/** Totals for the staff dashboard. One query, not five. */
export async function countOrdersByStatus(): Promise<Record<string, number>> {
  const rows = await db
    .select({
      status: orders.status,
      n: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(eq(orders.storeId, STORE_ID))
    .groupBy(orders.status)

  return Object.fromEntries(rows.map((r) => [r.status, r.n]))
}
