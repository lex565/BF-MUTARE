import { siteOrigin, BRAND } from '@/lib/brand'

/**
 * One canonical address per thing, and one place that knows it.
 *
 * WHY THIS FILE EXISTS
 *
 * A product had three addresses. `/product/{slug}` was Muroora Mart's own shop
 * route and 404'd for every other merchant. `/marketplace/product/{merchant}/
 * {product}` worked but nothing linked to it. `/stores/{slug}` listed products
 * and linked to the second one. Each was built for a different surface and
 * none of them agreed, so a shared link, a feed card and a storefront card
 * could point three different places at the same item.
 *
 * THE CANONICAL SHAPE
 *
 *   /stores/{merchantSlug}                          the shop
 *   /stores/{merchantSlug}/product/{productSlug}    an item, inside the shop
 *
 * The product address is nested under the shop because that is what both
 * briefs are actually asking for: a customer opening a shared link should land
 * knowing whose shop they are in, and the URL is the first thing that tells
 * them. `/stores/` is already live, already indexed and already the storefront,
 * so nesting reuses it rather than introducing a competing `/store/` that
 * would leave the platform with two spellings of the same idea.
 *
 * The old `/marketplace/product/...` links still work. They redirect here
 * permanently rather than 404ing, because some of them have already been sent
 * to people.
 *
 * NO DATABASE IMPORTS HERE, DELIBERATELY. Client components need to build a
 * share URL, and anything reaching @/db drags the postgres driver into the
 * browser bundle. Same reason lib/platform/provider-types.ts imports nothing.
 */

export function productPath(merchantSlug: string, productSlug: string): string {
  return `/stores/${merchantSlug}/product/${productSlug}`
}

export function storePath(merchantSlug: string): string {
  return `/stores/${merchantSlug}`
}

/**
 * The absolute, publicly shareable address.
 *
 * ALWAYS ABSOLUTE. The share message used to send `/marketplace/product/the-
 * pant-and-perfume-shop/cotton-pants` - a bare path with no host - so anybody
 * receiving it on WhatsApp got unclickable text and no way to reach the
 * product. A share link that is not a URL is not a share link.
 *
 * Always on the Musuwo origin, even when this code runs on the Muroora
 * deployment. Both sites serve the same application, but a marketplace product
 * belongs to the marketplace: sending somebody to muroora.online to look at
 * The Pant and Perfume Shop's stock would put one merchant's name above
 * another merchant's product.
 */
export function productUrl(merchantSlug: string, productSlug: string): string {
  return `${BRAND.musuwo.url}${productPath(merchantSlug, productSlug)}`
}

export function storeUrl(merchantSlug: string): string {
  return `${BRAND.musuwo.url}${storePath(merchantSlug)}`
}

/**
 * Where to send somebody after they sign in.
 *
 * Returns a PATH ONLY, never an absolute URL, and only one that starts with a
 * single slash. That is the whole open-redirect defence: `//evil.example.com`
 * is a protocol-relative URL that browsers treat as another origin, and
 * `https://evil.example.com` is obviously one, so both are refused and the
 * caller falls back to the homepage.
 *
 * The brief asks that a logged-out visitor who opens a shared product, tries
 * to buy, and signs in, comes back to that product rather than the homepage.
 * This is what makes that safe to implement.
 */
export function safeReturnPath(candidate: string | null | undefined): string {
  if (!candidate) return '/'
  if (!candidate.startsWith('/')) return '/'
  if (candidate.startsWith('//')) return '/'
  // A backslash is treated as a slash by some browsers when resolving a URL,
  // so `/\evil.example.com` can escape the origin the same way `//` does.
  if (candidate.includes('\\')) return '/'
  return candidate
}

/** The origin this deployment is actually served on. */
export { siteOrigin }
