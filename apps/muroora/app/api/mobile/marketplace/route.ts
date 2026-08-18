import { mobileOk, mobileOptions } from '@/app/api/mobile/_lib'
import {
  getMarketplaceProducts,
  getPublicBusinesses,
} from '@/lib/services/marketplace-cache'

export const dynamic = 'force-dynamic'
export const OPTIONS = mobileOptions

/**
 * What the app's Discover tab should show: real businesses, real products.
 *
 * IT REPLACES THREE HARD-CODED ARRAYS. The app shipped with invented listings -
 * a bookshop, a boarding house, a tutor - each with a price and an area, none
 * of which existed. A tester could tap one and go looking for a shop that was
 * never real. The same fake data was deleted from the website; this is the
 * other half of that.
 *
 * PUBLIC AND UNAUTHENTICATED, because browsing is. It returns exactly what the
 * website's directory returns: approved businesses only, contact details
 * absent, and `verified` as a boolean with no licence number behind it.
 */
export async function GET() {
  const [businesses, products] = await Promise.all([
    getPublicBusinesses(),
    getMarketplaceProducts(),
  ])

  return mobileOk({
    businesses,
    products,
    // So an empty marketplace reads as "nobody has joined yet" on the phone
    // rather than as a screen that failed to load.
    isEmpty: businesses.length === 0,
  })
}
