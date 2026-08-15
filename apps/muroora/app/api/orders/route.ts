import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { resolveCartOwner } from '@/app/api/_lib/cart-owner'
import { fail, ok, serialiseMoney } from '@/app/api/_lib/respond'
import { currentUser } from '@/lib/auth'
import {
  OrderError,
  listOrdersForUser,
  placeOrder,
  customerFacingStatus,
} from '@/lib/services/orders'

/**
 * Orders.
 *
 *   POST /api/orders   place one
 *   GET  /api/orders   the signed-in buyer's own orders
 *
 * POST DOES NOT REQUIRE AN ACCOUNT. The brief is explicit that a customer can
 * shop without signing up, and forcing a registration at the last step is the
 * single most reliable way to lose the sale. A guest order is identified by
 * the cart cookie; if they are signed in, the order is attached to them.
 *
 * IDEMPOTENCY IS REQUIRED, NOT OPTIONAL. Send a fresh `idempotencyKey` — a
 * UUID is ideal — with each genuine attempt, and THE SAME ONE on every retry
 * of that attempt. On a bad connection the client cannot tell a lost response
 * from a lost request; the key is what makes retrying safe. Repeating a key
 * replays the original order rather than placing a second one.
 */
export const dynamic = 'force-dynamic'

const recipientSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(6).max(20),
  relationship: z.string().trim().max(60).optional(),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  suburb: z.string().trim().min(1).max(80),
  city: z.string().trim().max(80).optional(),
  directions: z.string().trim().max(500).optional(),
  alternativeContactName: z.string().trim().max(120).optional(),
  alternativeContactPhone: z.string().trim().max(20).optional(),
})

const buyerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160).optional().or(z.literal('')),
  phone: z.string().trim().max(20).optional(),
  countryCode: z.string().trim().max(4).optional(),
})

const placeSchema = z.object({
  buyer: buyerSchema,
  recipient: recipientSchema,
  idempotencyKey: z.string().trim().min(8).max(200),
  substitutionPreference: z
    .enum(['NONE', 'SIMILAR', 'CONTACT_ME'])
    .optional(),
  customerNote: z.string().trim().max(1000).optional(),
})

/** Service error code → HTTP envelope code. */
const httpCodeFor = (error: OrderError) => {
  switch (error.code) {
    case 'EMPTY_CART':
    case 'INVALID_DETAILS':
      return 'BAD_REQUEST' as const
    case 'STOCK_CHANGED':
      return 'INSUFFICIENT_STOCK' as const
    case 'NO_DELIVERY':
      return 'NOT_FOUND' as const
    case 'BELOW_MINIMUM':
    case 'ILLEGAL_TRANSITION':
      return 'CONFLICT' as const
    case 'NOT_FOUND':
      return 'NOT_FOUND' as const
    default:
      return 'BAD_REQUEST' as const
  }
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail('BAD_REQUEST', 'Expected a JSON body.')
  }

  const parsed = placeSchema.safeParse(body)
  if (!parsed.success) {
    return fail(
      'BAD_REQUEST',
      'Some details are missing or malformed.',
      parsed.error.issues.map((i) => ({
        field: i.path.join('.'),
        problem: i.message,
      })),
    )
  }

  const { owner } = await resolveCartOwner()
  const user = await currentUser()

  try {
    const order = await placeOrder({
      owner,
      userId: user?.id,
      buyer: {
        ...parsed.data.buyer,
        email: parsed.data.buyer.email || undefined,
      },
      recipient: parsed.data.recipient,
      idempotencyKey: parsed.data.idempotencyKey,
      substitutionPreference: parsed.data.substitutionPreference,
      customerNote: parsed.data.customerNote,
    })

    return ok(
      {
        orderNumber: order.orderNumber,
        status: order.status,
        customerStatus: customerFacingStatus(order.status),
        subtotal: serialiseMoney(order.subtotal),
        deliveryFee: serialiseMoney(order.deliveryFee),
        total: serialiseMoney(order.total),
        itemCount: order.itemCount,
        recipientName: order.recipientName,
        deliverySuburb: order.deliverySuburb,
        zoneName: order.zoneName,
        estimatedMinutesMin: order.estimatedMinutesMin,
        estimatedMinutesMax: order.estimatedMinutesMax,
        placedAt: order.placedAt.toISOString(),
        /** True when this repeated an earlier request. Not an error. */
        replayed: order.replayed,
      },
      // A replay is 200: nothing new was created. A genuine placement is 201.
      { status: order.replayed ? 200 : 201 },
    )
  } catch (error) {
    if (error instanceof OrderError) {
      return fail(httpCodeFor(error), error.message, error.detail)
    }
    console.error('[POST /api/orders]', error)
    return fail('SERVER_ERROR', 'Could not place the order. Nothing was charged.')
  }
}

export async function GET() {
  const user = await currentUser()
  if (!user) {
    // Guest orders are not listable: without an account there is nothing to
    // prove the asker is the same person. They get the order number at
    // checkout and can look that one up directly.
    return fail(
      'UNAUTHENTICATED',
      'Sign in to see your orders, or look one up by its order number.',
    )
  }

  const rows = await listOrdersForUser(user.id)

  return ok({
    orders: rows.map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      customerStatus: customerFacingStatus(o.status),
      placedAt: o.placedAt?.toISOString() ?? null,
      recipientName: o.recipientName,
      deliverySuburb: o.deliverySuburb,
      itemCount: o.itemCount,
      total: serialiseMoney(o.total),
    })),
  })
}
