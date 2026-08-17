import { NextResponse } from 'next/server'

import { getMarketplaceProducts } from '@/lib/services/marketplace-cache'

/**
 * The public Musuwo catalogue.
 *
 * PUBLIC ON PURPOSE, and safe because of what the service does not select.
 * `listMarketplaceProducts` lists its columns explicitly, so the cost price
 * never leaves the database and no merchant contact detail is included.
 *
 * An empty array is a legitimate answer and the honest one today: no product
 * has been consented into the marketplace yet. Web and mobile both drop their
 * "nothing to show" state as soon as this returns rows, so nothing needs
 * redeploying when the first merchant publishes.
 *
 * Cached and invalidated by tag rather than by a clock. Publishing a product,
 * withdrawing one, or suspending a business drops this immediately - see
 * lib/services/marketplace-cache.ts.
 */
export async function GET() {
  try {
    return NextResponse.json({ data: await getMarketplaceProducts() })
  } catch (error) {
    console.error('[api/marketplace/products]', error)
    return NextResponse.json(
      { error: { code: 'UNAVAILABLE', message: 'The marketplace could not be loaded.' } },
      { status: 503 },
    )
  }
}
