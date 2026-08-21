import type { NextRequest } from 'next/server'

import { fail, ok } from '@/app/api/_lib/respond'
import { quoteDelivery } from '@/lib/services/delivery-quote'
import { PRICING_VERSION, metresToKmDisplay } from '@/lib/delivery/tariff'

/**
 * What a delivery costs, decided by the server.
 *
 *   POST /api/delivery/quote
 *   { "businessId": "uuid",
 *     "deliveryLatitude": -18.9707, "deliveryLongitude": 32.6709,
 *     "isHeavyOrOversized": false, "currency": "USD" }
 *
 * Implements section 5 of MUSUWO_DELIVERY_PRICING_IMPLEMENTATION_HANDOFF.md.
 *
 * POST rather than GET, and that is not a REST preference. A GET puts the
 * customer's home coordinates in a URL, and URLs go into server logs, proxy
 * logs, browser history and any Referer header the page later sends. A
 * delivery address is exactly the kind of thing that should not be sitting in
 * a log line.
 *
 * No authentication. Somebody deciding whether to buy needs the delivery price
 * before they will make an account, and this endpoint reveals nothing about
 * anybody: it takes a location the caller already knows and returns a number.
 *
 * WHAT THE CLIENT MAY DO WITH THE ANSWER: display it. Nothing else. The fee is
 * not recalculated at checkout from anything posted here - checkout sends back
 * `quoteId` and the server reads its own row. See lib/services/delivery-quote.ts.
 */
export const dynamic = 'force-dynamic'

interface Body {
  businessId?: unknown
  deliveryLatitude?: unknown
  deliveryLongitude?: unknown
  isHeavyOrOversized?: unknown
  currency?: unknown
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return fail('BAD_REQUEST', 'Send a JSON body.')
  }

  const businessId = typeof body.businessId === 'string' ? body.businessId.trim() : ''
  if (!UUID.test(businessId)) {
    return fail('BAD_REQUEST', 'businessId must be a UUID.')
  }

  const latitude = Number(body.deliveryLatitude)
  const longitude = Number(body.deliveryLongitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return fail(
      'BAD_REQUEST',
      'deliveryLatitude and deliveryLongitude must be numbers in degrees.',
    )
  }

  // The handoff's contract carries a currency field. Everything is USD today,
  // and a request asking for anything else is refused rather than quietly
  // answered in dollars - a fee returned in the wrong currency is a fee
  // nobody can reconcile. See the note on ZiG in lib/money.ts.
  if (body.currency !== undefined && body.currency !== 'USD') {
    return fail('BAD_REQUEST', 'Delivery is priced in USD only.')
  }

  try {
    const quote = await quoteDelivery({
      businessId,
      destination: { latitude, longitude },
      isHeavyOrOversized: body.isHeavyOrOversized === true,
    })

    if (!quote.serviceable) {
      /* `internalDetail` is deliberately NOT sent. It names the routing
         provider, the service-area polygon and whether a merchant has
         coordinates - operator information, of no use to a customer and of
         some use to somebody probing the system. It is logged instead. */
      if (quote.internalDetail) {
        console.warn(
          `[POST /api/delivery/quote] ${quote.serviceabilityReason} ` +
            `business=${businessId}: ${quote.internalDetail}`,
        )
      }

      return ok({
        quoteId: quote.quoteId,
        pricingVersion: quote.pricingVersion,
        serviceable: false,
        serviceabilityReason: quote.serviceabilityReason,
        roadDistanceKm: null,
        customerDeliveryFeeCents: null,
        currency: 'USD',
        manualReviewAvailable: quote.manualReviewAvailable,
        message: customerMessage(quote.serviceabilityReason),
      })
    }

    return ok({
      quoteId: quote.quoteId,
      pricingVersion: quote.pricingVersion,
      serviceable: true,
      serviceabilityReason: quote.serviceabilityReason,
      roadDistanceKm:
        quote.roadDistanceMetres === null
          ? null
          : metresToKmDisplay(quote.roadDistanceMetres),
      estimatedTravelTimeMinutes:
        quote.estimatedTimeSeconds === null
          ? null
          : Math.round(quote.estimatedTimeSeconds / 60),
      standardFeeCents: quote.standardFeeCents,
      oversizeFeeCents: quote.oversizeFeeCents,
      promotionSubsidyCents: quote.promotionSubsidyCents,
      customerDeliveryFeeCents: quote.customerDeliveryFeeCents,
      currency: 'USD',
      expiresAt: quote.expiresAt?.toISOString() ?? null,
    })
  } catch (error) {
    console.error('[POST /api/delivery/quote]', error)
    return fail('SERVER_ERROR', 'Could not work out a delivery fee.')
  }
}

/**
 * The wording from section 7 of the handoff.
 *
 * Kept beside the reason codes rather than in the client, so web and mobile
 * cannot drift into telling a customer two different things about the same
 * refusal.
 */
function customerMessage(reason: string): string {
  switch (reason) {
    case 'NO_NETWORK_ROUTE':
      return (
        'We could not confirm a road route to this location. Check your map ' +
        'pin or request manual delivery confirmation.'
      )
    case 'MANUAL_QUOTE_REQUIRED':
    case 'TOO_FAR':
      return (
        'This location is outside standard delivery range. Contact Musuwo ' +
        'for a manual delivery quote.'
      )
    case 'OUTSIDE_SERVICE_AREA':
      return (
        'We do not deliver to this area yet. Contact Musuwo to ask about it.'
      )
    case 'BUSINESS_NOT_DELIVERING':
      return 'This shop does not deliver. You can arrange collection with them.'
    case 'INVALID_LOCATION':
      return (
        'We could not read that delivery location. Move the map pin to the ' +
        'delivery address and try again.'
      )
    default:
      return 'We could not price a delivery to this location.'
  }
}

/** Which tariff is in force. Useful to a client showing "delivery from $2". */
export async function GET() {
  return ok({ pricingVersion: PRICING_VERSION, currency: 'USD' })
}
