/**
 * Which site this deployment is.
 *
 * ONE CODEBASE, TWO WEBSITES.
 *
 * Musuwo (the marketplace) and Muroora Mart (a shop inside it) are separate
 * websites on separate domains, but they are the same application: same
 * database, same accounts, same cart, same checkout, same staff and admin
 * screens. Somebody signed in on one is signed in on the other.
 *
 * The alternative was a second Next app. That would have forked authentication,
 * the cart, checkout, orders, staff and the admin screens into two copies that
 * drift, and every backend fix would have to be made twice. A brand switch is
 * one environment variable and no duplication.
 *
 * WHAT THIS ACTUALLY CHANGES: the homepage, the navigation, the logo and the
 * page titles. Nothing else. Every route still exists on both deployments, so
 * a link that worked before still works.
 *
 * Set NEXT_PUBLIC_SITE_BRAND per Vercel project:
 *
 *   musuwo   -> the marketplace. `/` is the business directory.
 *   muroora  -> Muroora Mart's own shop. `/` is its storefront.
 *
 * It must be NEXT_PUBLIC_ because the navigation is a client component and has
 * to know which logo to draw. There is nothing secret in it.
 *
 * Defaults to `musuwo` so a deployment that forgets the variable shows the
 * marketplace rather than failing.
 */

export type SiteBrand = 'musuwo' | 'muroora'

export const SITE_BRAND: SiteBrand =
  process.env.NEXT_PUBLIC_SITE_BRAND === 'muroora' ? 'muroora' : 'musuwo'

export const isMuroora = SITE_BRAND === 'muroora'
export const isMusuwo = SITE_BRAND === 'musuwo'

interface BrandCopy {
  name: string
  tagline: string
  description: string
  /** Where the logo in the navigation points. */
  home: string
  /**
   * This deployment's public origin, used where an absolute URL is needed and
   * NEXT_PUBLIC_SITE_URL has not been set - password-reset redirects, mainly.
   * Hard-coding one of the two here is how a Musuwo customer used to be sent
   * to Muroora Mart to finish resetting their password.
   */
  url: string
}

export const BRAND: Record<SiteBrand, BrandCopy> = {
  musuwo: {
    name: 'Musuwo',
    tagline: 'local businesses, products and services',
    description:
      'Discover local businesses, products, food, accommodation and services through Musuwo. Muroora Mart is the founding merchant.',
    home: '/',
    url: 'https://musuwo.vercel.app',
  },
  muroora: {
    name: 'Muroora Mart',
    tagline: 'groceries and household essentials in Mutare',
    description:
      'Groceries and household goods in Mutare, with same-day delivery and a diaspora shopping service for families abroad.',
    home: '/',
    url: 'https://muroora-mart.vercel.app',
  },
}

export const brand = BRAND[SITE_BRAND]

/**
 * This deployment's origin.
 *
 * NEXT_PUBLIC_SITE_URL wins where it is set, because a preview deployment has
 * a URL nobody can predict. The brand record is the fallback so a deployment
 * that forgets the variable still sends people to its own site rather than to
 * the other brand's.
 */
export const siteOrigin = (): string =>
  process.env.NEXT_PUBLIC_SITE_URL ?? brand.url
