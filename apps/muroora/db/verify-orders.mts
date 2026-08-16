/**
 * Checkout and order creation.
 *
 *   npm run db:verify-orders
 *
 * The checks that matter here are the ones about money and stock, because those
 * are the two things a shop cannot recover from by apologising:
 *
 *   - the price on the order is the price at the time of sale, and stays that
 *     way when the shop puts prices up
 *   - the last bag of rice cannot be sold twice
 *   - a double-tap on a bad connection places ONE order
 *   - a failed line rolls the WHOLE order back, leaving no stock held
 *
 * Creates its own product, zone and cart, and clears them up. It creates a
 * temporary delivery zone because the shop has not configured real ones yet -
 * real zones and fees are the owner's to set, and none are invented here
 * beyond this throwaway.
 */

import postgres from 'postgres'
import { eq } from 'drizzle-orm'

import { db } from '@/db/client'
import { products } from '@/db/schema/catalogue'
import { inventory } from '@/db/schema/inventory'
import { deliveryZones } from '@/db/schema/delivery'
import { carts } from '@/db/schema/cart'
import { addToCart, getCart } from '@/lib/services/cart'
import {
  OrderError,
  cancelOrder,
  getOrder,
  placeOrder,
} from '@/lib/services/orders'
import { quoteDelivery, DeliveryError } from '@/lib/services/delivery'
import { money, toDecimal } from '@/lib/money'

const TAG = 'VERIFY-ORD'
const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID!
const raw = postgres(process.env.DIRECT_URL!, { max: 1, prepare: false })

let passed = 0
let failed = 0
const ok = (w: string) => {
  passed++
  console.log(`  PASS  ${w}`)
}
const bad = (w: string, d?: string) => {
  failed++
  console.log(`  FAIL  ${w}`)
  if (d) console.log(`        ${d}`)
}

const recipient = {
  name: 'Gogo Chido',
  phone: '0771234567',
  relationship: 'Grandmother',
  line1: '14 Herbert Chitepo Street',
  suburb: 'Verify Suburb',
}
const buyer = { name: 'Test Buyer', email: 'buyer@verify.test', countryCode: 'GB' }

const newKey = () => `verify-${Math.random().toString(36).slice(2)}-${Date.now()}`

console.log('\nCheckout - money, stock, and what happens when it goes wrong\n')

let productId = '', zoneId = '', token = '', secondToken = ''

try {
  /* ------------------------------------------------------------ fixtures */

  await raw`DELETE FROM delivery_zones WHERE name = ${TAG}`

  /**
   * Free the SKU from any previous run.
   *
   * The old test product cannot simply be deleted: it has an inventory row and
   * order lines pointing at it, and those order lines are the record of what
   * was sold. So its SKU is released and the product left deactivated, which
   * is exactly what a shop does with a line it stops carrying.
   */
  await raw`
    UPDATE products
    SET sku = ${TAG} || '-' || left(id::text, 8), is_active = false
    WHERE sku = ${TAG}
  `

  const [zone] = await db
    .insert(deliveryZones)
    .values({
      storeId: STORE_ID,
      name: TAG,
      suburbs: ['Verify Suburb', 'verify other'],
      baseFeeAmount: 300n, // $3.00
      // $4.00, so a single $4.99 item clears it. Set to $5.00 on the first
      // draft, which put one item a penny under and stopped the run - the
      // rule working, and a good reminder that a minimum set just above a
      // common single-item price blocks real sales.
      minimumOrderAmount: 400n,
      estimatedMinutesMin: 30,
      estimatedMinutesMax: 90,
      isActive: true,
    } as never)
    .returning()
  zoneId = zone.id

  const [product] = await db
    .insert(products)
    .values({
      storeId: STORE_ID,
      name: 'Verify Rice 2kg',
      slug: `verify-rice-${Date.now()}`,
      sku: TAG,
      unitSize: '2kg',
      priceAmount: 499n, // $4.99 - the classic float trap
      isActive: true,
      lowStockThreshold: 2,
    } as never)
    .returning()
  productId = product.id

  await db
    .insert(inventory)
    .values({ storeId: STORE_ID, productId, quantity: 3, reserved: 0 } as never)

  console.log('  note  1 product at $4.99, 3 in stock, $3.00 delivery, $5 minimum\n')

  /* ------------------------------------------------------- delivery fees */

  console.log('Delivery')

  const q = await quoteDelivery({
    suburb: 'VERIFY SUBURB  ',
    subtotal: money(1000n, 'USD'),
  })
  if (q.zone.id === zoneId) {
    ok('a suburb matches whatever the customer typed for case and spacing')
  } else {
    bad('suburb matching')
  }
  if (toDecimal(q.fee) === '3.00') {
    ok(`the fee is the zone's fee (${toDecimal(q.fee)})`)
  } else {
    bad('the fee is the zone fee', toDecimal(q.fee))
  }

  const low = await quoteDelivery({
    suburb: 'Verify Suburb',
    subtotal: money(200n, 'USD'),
  })
  if (low.belowMinimum && toDecimal(low.shortfall!) === '2.00') {
    ok('below the minimum, the customer is told exactly how short they are')
  } else {
    bad('minimum order shortfall', JSON.stringify(low))
  }

  try {
    await quoteDelivery({
      suburb: 'Nowhere At All',
      subtotal: money(1000n, 'USD'),
    })
    bad('an uncovered suburb is refused')
  } catch (e) {
    if (e instanceof DeliveryError && e.code === 'NO_ZONE') {
      ok('an uncovered suburb is refused, not given a default fee')
    } else {
      bad('an uncovered suburb is refused', String(e))
    }
  }

  /* --------------------------------------------------------- the order */

  console.log('\nPlacing an order')

  token = `verify-cart-${Date.now()}`
  await addToCart({ token }, productId, 2)

  const cart = await getCart({ token })
  if (toDecimal(cart.subtotal) === '9.98') {
    ok(`2 x $4.99 is $9.98, not $9.98 with a floating-point tail (${toDecimal(cart.subtotal)})`)
  } else {
    bad('cart subtotal', toDecimal(cart.subtotal))
  }

  const key = newKey()
  const order = await placeOrder({
    owner: { token },
    buyer,
    recipient,
    idempotencyKey: key,
  })

  if (/^MM-\d{6}$/.test(order.orderNumber)) {
    ok(`the order gets a readable number (${order.orderNumber})`)
  } else {
    bad('order number format', order.orderNumber)
  }
  if (toDecimal(order.total) === '12.98') {
    ok(`total = $9.98 goods + $3.00 delivery = ${toDecimal(order.total)}`)
  } else {
    bad('total', toDecimal(order.total))
  }
  if (order.status === 'PENDING_PAYMENT') {
    ok('it starts at PENDING_PAYMENT, not DRAFT - the customer has committed')
  } else {
    bad('initial status', order.status)
  }

  const [inv1] = await db
    .select()
    .from(inventory)
    .where(eq(inventory.productId, productId))
  if (inv1.reserved === 2 && inv1.quantity === 3) {
    ok('2 are held, 3 still on the shelf (reserving does not remove stock)')
  } else {
    bad('reservation', `reserved=${inv1.reserved} quantity=${inv1.quantity}`)
  }

  /* ------------------------------------------------ prices are frozen */

  console.log('\nThe price on the order is the price they were charged')

  await db
    .update(products)
    .set({ priceAmount: 999n })
    .where(eq(products.id, productId))

  const reread = await getOrder({
    orderNumber: order.orderNumber,
    requireBuyerId: null,
  })
  if (toDecimal(reread!.items[0].unitPrice) === '4.99') {
    ok('the shop raised the price to $9.99; the order still says $4.99')
  } else {
    bad('frozen price', toDecimal(reread!.items[0].unitPrice))
  }
  if (toDecimal(reread!.total) === '12.98') {
    ok('and the total did not move')
  } else {
    bad('frozen total', toDecimal(reread!.total))
  }

  await db
    .update(products)
    .set({ priceAmount: 499n })
    .where(eq(products.id, productId))

  /* ------------------------------------------------------- idempotency */

  console.log('\nTapping "Place order" twice')

  await raw`UPDATE carts SET converted_order_id = NULL WHERE token = ${token}`
  const again = await placeOrder({
    owner: { token },
    buyer,
    recipient,
    idempotencyKey: key,
  })

  if (again.orderNumber === order.orderNumber && again.replayed) {
    ok('the same key replays the first order rather than placing a second')
  } else {
    bad('idempotent replay', `${again.orderNumber} replayed=${again.replayed}`)
  }

  const [{ n: orderCount }] = await raw`
    SELECT count(*)::int AS n FROM orders WHERE order_number = ${order.orderNumber}
  `
  if (orderCount === 1) {
    ok('there is exactly one order in the database')
  } else {
    bad('order count', String(orderCount))
  }

  const [inv2] = await db
    .select()
    .from(inventory)
    .where(eq(inventory.productId, productId))
  if (inv2.reserved === 2) {
    ok('and the stock was only reserved once')
  } else {
    bad('double reservation', `reserved=${inv2.reserved}`)
  }

  /* --------------------------------------------- running out of stock */

  console.log('\nWhen somebody else takes the last one')

  secondToken = `verify-cart2-${Date.now()}`
  await addToCart({ token: secondToken }, productId, 1)

  // 3 in stock, 2 already held. One is sellable, so this must work.
  const small = await placeOrder({
    owner: { token: secondToken },
    buyer,
    recipient,
    idempotencyKey: newKey(),
  })
  if (small.orderNumber !== order.orderNumber) {
    ok('a second customer can still buy the one that is left')
  } else {
    bad('second order')
  }

  const [inv3] = await db
    .select()
    .from(inventory)
    .where(eq(inventory.productId, productId))
  if (inv3.reserved === 3) {
    ok('all 3 are now held, nothing is sellable')
  } else {
    bad('reserved after second order', `reserved=${inv3.reserved}`)
  }

  // Force a cart that asks for more than exists, bypassing the cart's own
  // advisory check - this is the race the row lock has to catch.
  const thirdToken = `verify-cart3-${Date.now()}`
  const [c3] = await db
    .insert(carts)
    .values({ storeId: STORE_ID, token: thirdToken } as never)
    .returning()
  await raw`
    INSERT INTO cart_items (cart_id, product_id, quantity)
    VALUES (${c3.id}, ${productId}, 2)
  `

  const ordersBefore = await raw`SELECT count(*)::int AS n FROM orders`
  try {
    await placeOrder({
      owner: { token: thirdToken },
      buyer,
      recipient,
      idempotencyKey: newKey(),
    })
    bad('an order for stock that is gone is refused')
  } catch (e) {
    if (e instanceof OrderError && e.code === 'STOCK_CHANGED') {
      ok('an order for stock that is gone is refused')
    } else {
      bad('out-of-stock refusal', String(e))
    }
  }

  const ordersAfter = await raw`SELECT count(*)::int AS n FROM orders`
  if (ordersBefore[0].n === ordersAfter[0].n) {
    ok('and NO half-order was left behind - the whole thing rolled back')
  } else {
    bad('rollback', `${ordersBefore[0].n} -> ${ordersAfter[0].n}`)
  }

  const [inv4] = await db
    .select()
    .from(inventory)
    .where(eq(inventory.productId, productId))
  if (inv4.reserved === 3) {
    ok('and no stock was left held by the failed attempt')
  } else {
    bad('stock leaked on failure', `reserved=${inv4.reserved}`)
  }

  await raw`DELETE FROM carts WHERE id = ${c3.id}`

  /* -------------------------------------------------------- validation */

  console.log('\nRefusing bad details')

  const fourthToken = `verify-cart4-${Date.now()}`
  await raw`
    INSERT INTO carts (store_id, token) VALUES (${STORE_ID}, ${fourthToken})
  `

  for (const [what, bad_] of [
    ['a missing recipient phone', { ...recipient, phone: '' }],
    ['a phone that is too short', { ...recipient, phone: '077' }],
    ['a missing suburb', { ...recipient, suburb: '' }],
    ['a missing street', { ...recipient, line1: '' }],
  ] as const) {
    try {
      await placeOrder({
        owner: { token: fourthToken },
        buyer,
        recipient: bad_,
        idempotencyKey: newKey(),
      })
      bad(`${what} is refused`)
    } catch (e) {
      if (e instanceof OrderError && e.code === 'INVALID_DETAILS') {
        ok(`${what} is refused`)
      } else {
        bad(`${what} is refused`, String(e))
      }
    }
  }

  await raw`DELETE FROM carts WHERE token = ${fourthToken}`

  /* ------------------------------------------------------ cancellation */

  console.log('\nCancelling')

  try {
    await cancelOrder({
      orderId: (await getOrder({
        orderNumber: order.orderNumber,
        requireBuyerId: null,
      }))!.id,
      reason: '',
      actorType: 'CUSTOMER',
    })
    bad('a cancellation without a reason is refused')
  } catch (e) {
    if (e instanceof OrderError) ok('a cancellation without a reason is refused')
    else bad('cancel reason', String(e))
  }

  const full = (await getOrder({
    orderNumber: order.orderNumber,
    requireBuyerId: null,
  }))!
  await cancelOrder({
    orderId: full.id,
    reason: 'Verification run',
    actorType: 'CUSTOMER',
  })

  const cancelled = (await getOrder({
    orderNumber: order.orderNumber,
    requireBuyerId: null,
  }))!
  if (cancelled.status === 'CANCELLED') {
    ok('the order is cancelled')
  } else {
    bad('cancel status', cancelled.status)
  }

  const [inv5] = await db
    .select()
    .from(inventory)
    .where(eq(inventory.productId, productId))
  if (inv5.reserved === 1) {
    ok('and the 2 it was holding went back on the shelf')
  } else {
    bad('stock released on cancel', `reserved=${inv5.reserved}, expected 1`)
  }

  const cancelEvent = cancelled.events.find(
    (e) => e.eventType === 'ORDER_CANCELLED',
  )
  if (cancelEvent) {
    ok('with an event saying who cancelled it')
  } else {
    bad('cancellation event')
  }

  // The contents, not just the row. An existence check passed for weeks while
  // every event stored "[object Object]" and the reason was thrown away.
  if (
    cancelEvent &&
    typeof cancelEvent.metadata === 'object' &&
    cancelEvent.metadata !== null &&
    cancelEvent.metadata.reason === 'Verification run'
  ) {
    ok('and the event actually CONTAINS the reason given')
  } else {
    bad(
      'the cancellation event contains the reason',
      `stored: ${JSON.stringify(cancelEvent?.metadata)}`,
    )
  }

  const placedEvent = cancelled.events.find(
    (e) => e.eventType === 'ORDER_PLACED',
  )
  if (
    placedEvent &&
    typeof placedEvent.metadata === 'object' &&
    placedEvent.metadata !== null &&
    placedEvent.metadata.zone === TAG
  ) {
    ok('and the placement event kept which area it was for')
  } else {
    bad('placement event detail', JSON.stringify(placedEvent?.metadata))
  }

  /* --------------------------------------------------- who may look */

  console.log('\nAn order number is not a password')

  const guessed = await getOrder({
    orderNumber: order.orderNumber,
    requireBuyerId: 'e6f0a3c2-0000-4000-8000-000000000000',
  })
  if (guessed === null) {
    ok("someone else's user id cannot open the order")
  } else {
    bad('order privacy', 'it was returned')
  }
} catch (error) {
  // Printed rather than swallowed. A throw here means a check never ran, which
  // is worse than a failed check - a silent skip looks like a pass.
  failed++
  console.log('\n  FAIL  the run stopped early')
  console.log(`        ${error instanceof Error ? error.message : String(error)}`)
  if (error instanceof Error && error.stack) {
    console.log(
      error.stack.split('\n').slice(1, 4).map((l) => `        ${l.trim()}`).join('\n'),
    )
  }
} finally {
  /**
   * Cleanup, within what the database allows.
   *
   * TEST ORDERS CANNOT BE DELETED, and that is correct: `order_events` is
   * append-only, so deleting an order to erase its history is refused. Orders
   * are cancelled, never removed - the same rule a real mistaken order lives
   * under.
   *
   * So the orders and their lines stay, cancelled, and the product they point
   * at is deactivated rather than deleted. The dev database should be reset
   * before real trading begins; see TASKS.md.
   */
  console.log('\nCleanup')

  for (const t of [token, secondToken]) {
    if (t) await raw`DELETE FROM carts WHERE token = ${t}`
  }

  const stragglers = await raw`
    SELECT id, order_number, status FROM orders
    WHERE recipient_name = ${recipient.name} AND status <> 'CANCELLED'
  `
  for (const s of stragglers) {
    try {
      await cancelOrder({
        orderId: s.id as string,
        reason: 'Verification run cleanup',
        actorType: 'SYSTEM',
      })
    } catch {
      // Already cancelled, or in a state that refuses it. Reported below.
    }
  }
  if (stragglers.length > 0) {
    console.log(`  cancelled ${stragglers.length} test order(s) so the staff queue stays clean`)
  }

  if (productId) {
    // Deactivated, not deleted: order_items point at it, and those rows are
    // the record of what was sold. Hidden from the shop is enough.
    await raw`
      UPDATE products SET is_active = false, name = 'VERIFY (test data)'
      WHERE id = ${productId}
    `
  }
  if (zoneId) await raw`DELETE FROM delivery_zones WHERE id = ${zoneId}`
  await raw`
    DELETE FROM idempotency_keys
    WHERE scope = 'checkout' AND response LIKE ${'%' + recipient.name + '%'}
  `

  const leftOrders = await raw`
    SELECT count(*)::int AS n FROM orders WHERE recipient_name = ${recipient.name}
  `
  console.log(
    `  ${leftOrders[0].n} cancelled test order(s) remain - they cannot be deleted,`,
  )
  console.log('  because order_events is append-only. That is the rule working.')

  await raw.end()
}

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
