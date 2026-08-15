import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { fail, ok, serialiseMoney } from '@/app/api/_lib/respond'
import { currentUser, isStaff } from '@/lib/auth'
import { OrderError, cancelOrder, getOrder } from '@/lib/services/orders'

/**
 * One order.
 *
 *   GET    /api/orders/MM-000001   look it up
 *   DELETE /api/orders/MM-000001   cancel it   { reason }
 *
 * An order number appears in WhatsApp messages and gets read down a phone
 * line, so it is guessable by design — MM-000002 follows MM-000001. That means
 * the number ALONE MUST NEVER BE ENOUGH to see an order: it carries a
 * recipient's name, address and phone number.
 *
 * So: staff see any order. A signed-in buyer sees their own. Everyone else
 * gets 404 — not 403, which would confirm the order exists.
 */
export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const { orderNumber } = await params
  const user = await currentUser()

  const order = await getOrder({
    orderNumber: decodeURIComponent(orderNumber),
    // Staff pass null after their role check. A signed-in customer is pinned
    // to their own orders. A guest gets null buyer matching, which fails.
    requireBuyerId: isStaff(user) ? null : (user?.id ?? '\0'),
  })

  if (!order) {
    return fail('NOT_FOUND', 'No order with that number.')
  }

  return ok({
    orderNumber: order.orderNumber,
    status: order.status,
    customerStatus: order.customerStatus,
    placedAt: order.placedAt?.toISOString() ?? null,

    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    deliveryLine1: order.deliveryLine1,
    deliveryLine2: order.deliveryLine2,
    deliverySuburb: order.deliverySuburb,
    deliveryCity: order.deliveryCity,
    deliveryDirections: order.deliveryDirections,

    buyerName: order.buyerName,
    customerNote: order.customerNote,
    substitutionPreference: order.substitutionPreference,

    subtotal: serialiseMoney(order.subtotal),
    deliveryFee: serialiseMoney(order.deliveryFee),
    total: serialiseMoney(order.total),

    items: order.items.map((i) => ({
      name: i.productName,
      sku: i.productSku,
      unitSize: i.unitSize,
      quantity: i.quantity,
      unitPrice: serialiseMoney(i.unitPrice),
      lineTotal: serialiseMoney(i.lineTotal),
      quantityPicked: i.quantityPicked,
    })),

    // The history, in plain terms. Staff get the internal status changes;
    // a customer gets what happened, not the internal state machine.
    history: order.events.map((e) => ({
      what: e.eventType,
      at: e.createdAt.toISOString(),
      ...(isStaff(user)
        ? { from: e.previousStatus, to: e.newStatus, by: e.actorType }
        : {}),
    })),
  })
}

const cancelSchema = z.object({
  reason: z.string().trim().min(3).max(500),
})

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const { orderNumber } = await params
  const user = await currentUser()

  if (!user) {
    return fail(
      'UNAUTHENTICATED',
      'Sign in to cancel an order, or phone the shop.',
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail('BAD_REQUEST', 'Expected a JSON body with a reason.')
  }

  const parsed = cancelSchema.safeParse(body)
  if (!parsed.success) {
    return fail('BAD_REQUEST', 'A cancellation needs a reason.')
  }

  const staff = isStaff(user)
  const order = await getOrder({
    orderNumber: decodeURIComponent(orderNumber),
    requireBuyerId: staff ? null : user.id,
  })

  if (!order) return fail('NOT_FOUND', 'No order with that number.')

  try {
    await cancelOrder({
      orderId: order.id,
      reason: parsed.data.reason,
      actorType: staff ? 'STAFF' : 'CUSTOMER',
      actorId: user.id,
    })
    return ok({ orderNumber: order.orderNumber, status: 'CANCELLED' })
  } catch (error) {
    if (error instanceof OrderError) {
      return fail(
        error.code === 'ILLEGAL_TRANSITION' ? 'CONFLICT' : 'BAD_REQUEST',
        error.message,
      )
    }
    console.error('[DELETE /api/orders/:orderNumber]', error)
    return fail('SERVER_ERROR', 'Could not cancel the order.')
  }
}
