import { NextResponse } from 'next/server'

import { listPublicBusinesses } from '@/lib/services/marketplace'

export const dynamic = 'force-dynamic'

/**
 * The public business directory, shared by the web carousel and the app.
 *
 * ONE endpoint for both clients, deliberately. Two lists drift, and the way
 * they drift is that a business is suspended on one surface and still visible
 * on the other. When the first Housing business is approved, it appears on the
 * website and in the app on their next fetch, with no new build of either.
 *
 * Only ACTIVE and PILOT businesses are returned. Draft, submitted, rejected,
 * paused and suspended ones stay private - see `listPublicBusinesses`, which
 * also omits every contact column.
 */
export async function GET() {
  try {
    return NextResponse.json({ data: await listPublicBusinesses() })
  } catch (error) {
    console.error('[api/marketplace/businesses]', error)
    return NextResponse.json(
      { error: { code: 'UNAVAILABLE', message: 'The directory could not be loaded.' } },
      { status: 503 },
    )
  }
}
