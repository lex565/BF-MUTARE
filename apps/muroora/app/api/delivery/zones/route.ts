import type { NextRequest } from 'next/server'

import { fail, ok, serialiseMoney } from '@/app/api/_lib/respond'
import {
  DeliveryError,
  listActiveZones,
  quoteDelivery,
} from '@/lib/services/delivery'
import { money } from '@/lib/money'

/**
 * Delivery areas and fees.
 *
 *   GET /api/delivery/zones                       every area we cover
 *   GET /api/delivery/zones?suburb=X&subtotal=N   the fee for this order
 *
 * No authentication: a customer needs to know whether their aunt's suburb is
 * covered, and what it costs, before they will consider making an account.
 *
 * `subtotal` is the integer minor unit - cents - matching what the cart
 * endpoint returns as `subtotal.amount`. Send that value straight through; do
 * not send a decimal.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const suburb = request.nextUrl.searchParams.get('suburb')
  const subtotalRaw = request.nextUrl.searchParams.get('subtotal')

  if (!suburb) {
    const zones = await listActiveZones()
    return ok({
      zones: zones.map((zone) => ({
        id: zone.id,
        name: zone.name,
        description: zone.description,
        suburbs: zone.suburbs,
        fee: serialiseMoney(zone.fee),
        minimumOrder: serialiseMoney(zone.minimumOrder),
        estimatedMinutesMin: zone.estimatedMinutesMin,
        estimatedMinutesMax: zone.estimatedMinutesMax,
      })),
    })
  }

  let subtotalAmount: bigint
  try {
    subtotalAmount = BigInt(subtotalRaw ?? '0')
  } catch {
    return fail(
      'BAD_REQUEST',
      'subtotal must be a whole number of cents, e.g. 1250 for $12.50.',
    )
  }
  if (subtotalAmount < 0n) {
    return fail('BAD_REQUEST', 'subtotal cannot be negative.')
  }

  try {
    const quote = await quoteDelivery({
      suburb,
      subtotal: money(subtotalAmount, 'USD'),
    })

    return ok({
      zone: {
        id: quote.zone.id,
        name: quote.zone.name,
        estimatedMinutesMin: quote.zone.estimatedMinutesMin,
        estimatedMinutesMax: quote.zone.estimatedMinutesMax,
      },
      fee: serialiseMoney(quote.fee),
      minimumOrder: serialiseMoney(quote.zone.minimumOrder),
      belowMinimum: quote.belowMinimum,
      shortfall: quote.shortfall ? serialiseMoney(quote.shortfall) : null,
      /** Ready to check out, as far as delivery is concerned. */
      deliverable: !quote.belowMinimum,
    })
  } catch (error) {
    if (error instanceof DeliveryError) {
      // Not covered is an ordinary answer, not a server fault - 404 so a
      // client can branch on it, with the message ready to show.
      return fail('NOT_FOUND', error.message)
    }
    console.error('[GET /api/delivery/zones]', error)
    return fail('SERVER_ERROR', 'Could not work out a delivery fee.')
  }
}
