import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { resolveCartOwner, setCartCookie } from '@/app/api/_lib/cart-owner'
import { fail, ok, serialiseMoney } from '@/app/api/_lib/respond'
import {
  CartError,
  addToCart,
  clearCart,
  getCart,
  setCartQuantity,
  type CartView,
} from '@/lib/services/cart'

/**
 * The cart.
 *
 *   GET    /api/cart              read it
 *   POST   /api/cart              add   { productId, quantity? }
 *   PATCH  /api/cart              set   { productId, quantity }  (0 removes)
 *   DELETE /api/cart              empty it
 *
 * NO AUTHENTICATION REQUIRED, deliberately. The brief: customers browse and
 * build a cart without an account. A guest is identified by an httpOnly cookie
 * minted on first use; signing in later merges that cart into the account.
 */
export const dynamic = 'force-dynamic'

/** Money is serialised the same way everywhere — see respond.ts. */
function serialise(cart: CartView) {
  return {
    id: cart.id,
    itemCount: cart.itemCount,
    subtotal: serialiseMoney(cart.subtotal),
    hasProblems: cart.hasProblems,
    lines: cart.lines.map((line) => ({
      itemId: line.itemId,
      productId: line.productId,
      name: line.name,
      slug: line.slug,
      unitSize: line.unitSize,
      quantity: line.quantity,
      unitPrice: serialiseMoney(line.unitPrice),
      lineTotal: serialiseMoney(line.lineTotal),
      availability: line.availability,
      /** True when the shop can no longer fulfil this line in full. */
      exceedsStock: line.exceedsStock,
      sellable: line.sellable,
    })),
  }
}

const cartErrorCode = (error: CartError) =>
  error.code === 'INSUFFICIENT_STOCK'
    ? ('INSUFFICIENT_STOCK' as const)
    : error.code === 'INACTIVE_PRODUCT'
      ? ('CONFLICT' as const)
      : ('BAD_REQUEST' as const)

export async function GET() {
  try {
    const { owner, newToken } = await resolveCartOwner()
    const cart = await getCart(owner)
    const response = ok(serialise(cart))
    return newToken ? setCartCookie(response, newToken) : response
  } catch (error) {
    console.error('[api/cart GET]', error)
    return fail('SERVER_ERROR', 'Could not load your cart.')
  }
}

const addInput = z.object({
  productId: z.string().uuid('Which product?'),
  quantity: z.number().int().min(1).max(999).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = addInput.safeParse(body)
    if (!parsed.success) {
      return fail('BAD_REQUEST', parsed.error.issues[0].message)
    }

    const { owner, newToken } = await resolveCartOwner()
    const cart = await addToCart(
      owner,
      parsed.data.productId,
      parsed.data.quantity ?? 1,
    )

    const response = ok(serialise(cart), { status: 201 })
    return newToken ? setCartCookie(response, newToken) : response
  } catch (error) {
    if (error instanceof CartError) {
      // Stock messages are safe and useful to show verbatim: "only 3 left" is
      // exactly what the customer needs, and reveals nothing they could not
      // work out by trying to buy four.
      return fail(cartErrorCode(error), error.message)
    }
    console.error('[api/cart POST]', error)
    return fail('SERVER_ERROR', 'Could not add that to your cart.')
  }
}

const setInput = z.object({
  productId: z.string().uuid('Which product?'),
  quantity: z.number().int().min(0).max(999),
})

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = setInput.safeParse(body)
    if (!parsed.success) {
      return fail('BAD_REQUEST', parsed.error.issues[0].message)
    }

    const { owner, newToken } = await resolveCartOwner()
    const cart = await setCartQuantity(
      owner,
      parsed.data.productId,
      parsed.data.quantity,
    )

    const response = ok(serialise(cart))
    return newToken ? setCartCookie(response, newToken) : response
  } catch (error) {
    if (error instanceof CartError) {
      return fail(cartErrorCode(error), error.message)
    }
    console.error('[api/cart PATCH]', error)
    return fail('SERVER_ERROR', 'Could not update your cart.')
  }
}

export async function DELETE() {
  try {
    const { owner, newToken } = await resolveCartOwner()
    const cart = await clearCart(owner)
    const response = ok(serialise(cart))
    return newToken ? setCartCookie(response, newToken) : response
  } catch (error) {
    console.error('[api/cart DELETE]', error)
    return fail('SERVER_ERROR', 'Could not empty your cart.')
  }
}
