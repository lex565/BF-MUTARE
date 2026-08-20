import { NextResponse } from 'next/server'

import { currentUser } from '@/lib/auth'
import {
  recordEvent,
  recordImpressions,
  recordSearch,
  type DiscoverySurface,
  type ProductEventType,
} from '@/lib/services/discovery-events'
import {
  discoverySession,
  setDiscoveryCookie,
} from '@/lib/services/discovery-session'

/**
 * Where the browser and the app report what a customer did.
 *
 * THE SECURITY PROPERTY THIS ENDPOINT EXISTS TO HOLD
 *
 * A client can say what happened. It cannot say how much, to whom it counts,
 * or what it is worth.
 *
 *   - There is no `count` field. One request describes one occurrence.
 *   - There is no `businessId` field. Attribution is resolved from the product
 *     on the server, so a merchant cannot credit themselves with a rival's
 *     traffic or blame a rival for their own.
 *   - There is no `score`, `rank` or `weight` field. Ranking is computed in
 *     lib/services/for-you.ts and never accepted from outside.
 *   - `sessionId` is read from an httpOnly cookie, never from the body, so a
 *     caller cannot rotate it to defeat deduplication.
 *
 * That leaves the honest abuse case: somebody posts one impression, ten
 * thousand times, from a script. Deduplication in the service collapses those
 * onto one row per product per window, and the excluded-reason machinery marks
 * a merchant's own traffic. What remains is bounded and visible rather than
 * silently inflating a ranking.
 *
 * ALWAYS 204, EVEN ON A BAD BODY
 *
 * Analytics must never break a page. If the payload is malformed the event is
 * dropped and the response is still a success, because the alternative is a
 * console error on a customer's product page for something the customer does
 * not care about. Genuine faults are logged server-side.
 */

export const runtime = 'nodejs'

const EVENT_TYPES: ReadonlySet<string> = new Set<ProductEventType>([
  'PRODUCT_IMPRESSION',
  'PRODUCT_VIEW',
  'STORE_VISIT',
  'ADD_TO_CART',
  'REMOVE_FROM_CART',
  'CHECKOUT_STARTED',
  'ORDER_COMPLETED',
  'PRODUCT_SHARED',
  'SEARCH_RESULT_CLICKED',
])

const SURFACES: ReadonlySet<string> = new Set<DiscoverySurface>([
  'FOR_YOU',
  'SEARCH',
  'STOREFRONT',
  'CATEGORY',
  'SHARED_LINK',
  'DIRECT',
  'MOBILE_APP',
  'OTHER',
])

/**
 * ORDER_COMPLETED is refused here.
 *
 * Revenue is written by the order pipeline, from a committed order, on the
 * server. Accepting it over a public endpoint would let anybody post
 * themselves a sale, which is the one event where a forged row turns into a
 * wrong number on a merchant's revenue page.
 */
const SERVER_ONLY: ReadonlySet<string> = new Set<ProductEventType>([
  'ORDER_COMPLETED',
])

function ok(sessionId: string, isNew: boolean): NextResponse {
  const response = new NextResponse(null, { status: 204 })
  return isNew
    ? (setDiscoveryCookie(response, sessionId) as NextResponse)
    : response
}

export async function POST(request: Request) {
  const { sessionId, isNew } = await discoverySession()

  try {
    const body = (await request.json()) as Record<string, unknown>
    const user = await currentUser()
    const userId = user?.id ?? null

    const surface =
      typeof body.surface === 'string' && SURFACES.has(body.surface)
        ? (body.surface as DiscoverySurface)
        : 'OTHER'

    // ---- a page of impressions ------------------------------------------
    if (Array.isArray(body.impressions)) {
      const productIds = body.impressions.filter(
        (v): v is string => typeof v === 'string',
      )
      await recordImpressions({ productIds, surface, sessionId, userId })
      return ok(sessionId, isNew)
    }

    // ---- a search --------------------------------------------------------
    if (typeof body.search === 'string') {
      await recordSearch({
        query: body.search,
        // The count comes from the client because the client is what ran the
        // filter. It is a diagnostic for the market-gap report, not an input
        // to ranking, so a wrong value misleads a report rather than moving
        // somebody up the feed. Clamped so it cannot be absurd.
        resultCount: Math.max(
          0,
          Math.min(10_000, Number(body.resultCount) || 0),
        ),
        surface,
        sessionId,
        userId,
      })
      return ok(sessionId, isNew)
    }

    // ---- one event -------------------------------------------------------
    const eventType = body.event
    if (
      typeof eventType !== 'string' ||
      !EVENT_TYPES.has(eventType) ||
      SERVER_ONLY.has(eventType)
    ) {
      return ok(sessionId, isNew)
    }

    await recordEvent({
      eventType: eventType as ProductEventType,
      productId: typeof body.productId === 'string' ? body.productId : null,
      entryProductId:
        typeof body.entryProductId === 'string' ? body.entryProductId : null,
      /**
       * Only consulted for a STORE_VISIT with no product, which is the one
       * case where nothing else identifies the merchant. Whenever a product id
       * is present the service ignores this entirely and resolves ownership
       * from the product, so product performance - the only thing that feeds
       * ranking - is never attributable by the caller.
       *
       * The residual exposure is honest and worth writing down: a scripted
       * client can inflate a store's visit count, capped by deduplication at
       * one per session per two minutes. `store_visits` is a figure a merchant
       * reads, not an input to the feed, so the damage is a misleading number
       * on somebody's own dashboard rather than a bought ranking.
       */
      businessId: typeof body.storeBusinessId === 'string' ? body.storeBusinessId : null,
      surface,
      sessionId,
      userId,
    })

    return ok(sessionId, isNew)
  } catch (error) {
    console.error('[api/discovery]', error)
    return ok(sessionId, isNew)
  }
}
