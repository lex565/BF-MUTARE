import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'

import { db, type DbOrTx } from '@/db/client'
import {
  auditLog,
  businessApplications,
  businessMemberships,
  businesses,
  marketplaceProductViews,
  products,
  stores,
} from '@/db/schema'

/**
 * The Musuwo marketplace service.
 *
 * WHERE ISOLATION ACTUALLY LIVES.
 *
 * Row level security is on for every table (migrations 0008 and 0009), but it
 * does NOT isolate one business from another, and it is important not to
 * believe otherwise. The application connects as `postgres`, which owns the
 * tables and carries BYPASSRLS, so its queries are exempt by design. RLS stops
 * the public anon key reading the database directly; it does nothing about a
 * signed-in merchant asking this application for somebody else's data.
 *
 * That is this file's job. Every business-scoped read and write goes through
 * `requireMembership`, which resolves the caller's membership on the server.
 *
 * A business id arriving from a client is a REQUEST, never a permission.
 */

/**
 * Build a public storage URL from a stored bucket path.
 *
 * Returns null for a null path rather than a URL ending in "null", which is
 * what string interpolation would produce and which every consuming component
 * would then try to load.
 *
 * Only ever pointed at PUBLIC buckets. Verification documents live in
 * `business-verification`, which is private, and are reached exclusively
 * through the 60-second signed links in lib/platform/documents.ts - never
 * through this helper. Passing that bucket name here would produce a URL that
 * looks right and 404s, which is a confusing way to find out you have made a
 * serious mistake.
 */
function publicStorageUrl(bucket: string, path: string | null): string | null {
  if (!path) return null
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`
}

/** Statuses a member of the public may see. Everything else is private. */
const PUBLIC_STATUSES = ['ACTIVE', 'PILOT'] as const

/** Business roles that may change things. VIEWER is deliberately absent. */
const WRITE_ROLES = ['BUSINESS_OWNER', 'BUSINESS_ADMIN', 'BUSINESS_STAFF'] as const

export type BusinessMemberRole =
  | 'BUSINESS_OWNER'
  | 'BUSINESS_ADMIN'
  | 'BUSINESS_STAFF'
  | 'BUSINESS_VIEWER'

export class MarketplaceError extends Error {
  constructor(
    readonly code:
      | 'NOT_FOUND'
      | 'FORBIDDEN'
      | 'NOT_A_MEMBER'
      | 'READ_ONLY'
      | 'NOT_APPROVED'
      | 'ALREADY_APPLIED',
    message: string,
  ) {
    super(message)
    this.name = 'MarketplaceError'
  }
}

/* ------------------------------------------------------------ membership */

export interface Membership {
  businessId: string
  publicId: string
  name: string
  slug: string
  storeId: string | null
  status: string
  roles: BusinessMemberRole[]
  canWrite: boolean
}

/**
 * Every business the signed-in person may act for.
 *
 * The ONLY correct source for a business switcher. Returning the full business
 * list and filtering it in the client would ship every merchant's name to
 * every user.
 */
export async function myBusinesses(userId: string): Promise<Membership[]> {
  const rows = await db
    .select({
      businessId: businesses.id,
      publicId: businesses.publicId,
      name: businesses.name,
      slug: businesses.slug,
      storeId: businesses.storeId,
      status: businesses.status,
      role: businessMemberships.role,
    })
    .from(businessMemberships)
    .innerJoin(businesses, eq(businesses.id, businessMemberships.businessId))
    .where(
      and(
        eq(businessMemberships.userId, userId),
        isNull(businesses.deletedAt),
      ),
    )
    .orderBy(asc(businesses.name))

  const byBusiness = new Map<string, Membership>()
  for (const row of rows) {
    const existing = byBusiness.get(row.businessId)
    if (existing) {
      existing.roles.push(row.role as BusinessMemberRole)
    } else {
      byBusiness.set(row.businessId, {
        businessId: row.businessId,
        publicId: row.publicId,
        name: row.name,
        slug: row.slug,
        storeId: row.storeId,
        status: row.status,
        roles: [row.role as BusinessMemberRole],
        canWrite: false,
      })
    }
  }

  for (const m of byBusiness.values()) {
    m.canWrite = m.roles.some((r) =>
      (WRITE_ROLES as readonly string[]).includes(r),
    )
  }

  return [...byBusiness.values()]
}

/**
 * Resolve a caller's authority over one business, or refuse.
 *
 * CALL THIS AT THE TOP OF EVERY BUSINESS-SCOPED ROUTE. It is the difference
 * between "the client says it is business X" and "this person may act for
 * business X".
 *
 * `NOT_A_MEMBER` and `NOT_FOUND` deliberately carry the same message. Telling
 * somebody that a business exists but is not theirs confirms the existence of
 * a merchant they have no business knowing about.
 */
export async function requireMembership(
  userId: string,
  businessId: string,
  options: { write?: boolean } = {},
): Promise<Membership> {
  const all = await myBusinesses(userId)
  const found = all.find((m) => m.businessId === businessId)

  if (!found) {
    throw new MarketplaceError('NOT_A_MEMBER', 'No such business for this account.')
  }
  if (options.write && !found.canWrite) {
    throw new MarketplaceError(
      'READ_ONLY',
      'This account has oversight of that business but cannot change it.',
    )
  }
  return found
}

/* ---------------------------------------------------------------- public */

export interface PublicBusiness {
  /**
   * The internal id.
   *
   * Needed because a STORE_VISIT event is attributed to a business, and the
   * storefront is where that event is raised. It is a UUID, not a secret: it
   * names a business that is already public by definition, and every write
   * path resolves membership from the signed-in user rather than from an id a
   * client supplies.
   */
  id: string
  publicId: string
  name: string
  slug: string
  summary: string | null
  kind: string
  city: string
  logoPath: string | null
  /** One line for the storefront banner. See migration 0024. */
  tagline: string | null
  /**
   * Absolute URLs, resolved here from the stored bucket paths.
   *
   * The database holds a path and the application builds the URL - see the
   * note on migration 0024 for why storing a URL is the wrong shape. Doing the
   * resolution once, here, means no component has to know which bucket a logo
   * lives in, and a component that forgets cannot render a raw path as a src.
   */
  logoUrl: string | null
  coverImageUrl: string | null
  websiteUrl: string | null
  whatsappNumber: string | null
  faviconPath: string | null
  isFounding: boolean
  storefrontUrl: string | null
  /**
   * A licence has been seen by a person at Musuwo.
   *
   * A BOOLEAN, deliberately. The licence number and the document stay on the
   * server: the badge tells a customer the check happened, it does not
   * republish a business owner's registration details to every visitor.
   */
  verified: boolean
}

/**
 * Businesses the public may see.
 *
 * Columns are listed one by one rather than `select *`, and the contact
 * columns are absent on purpose: phone and email are released deliberately and
 * the release is recorded. A `select *` here would leak every merchant's
 * direct number into a public JSON response.
 *
 * Founding merchant first, then alphabetical, so the ordering is a stated rule
 * rather than whatever Postgres returns.
 */
export async function listPublicBusinesses(): Promise<PublicBusiness[]> {
  const rows = await db
    .select({
      id: businesses.id,
      publicId: businesses.publicId,
      name: businesses.name,
      slug: businesses.slug,
      summary: businesses.summary,
      tagline: businesses.tagline,
      kind: businesses.kind,
      city: businesses.city,
      logoPath: businesses.logoPath,
      coverImagePath: businesses.coverImagePath,
      websiteUrl: businesses.websiteUrl,
      whatsappNumber: businesses.whatsappNumber,
      faviconPath: businesses.faviconPath,
      isFounding: businesses.isFounding,
      verifiedAt: businesses.verifiedAt,
      storeSlug: stores.slug,
    })
    .from(businesses)
    .leftJoin(stores, eq(stores.id, businesses.storeId))
    .where(
      and(
        inArray(businesses.status, [...PUBLIC_STATUSES]),
        isNull(businesses.deletedAt),
      ),
    )
    .orderBy(desc(businesses.isFounding), asc(businesses.name))

  return rows.map(({ storeSlug, verifiedAt, coverImagePath, ...b }) => ({
    ...b,
    verified: verifiedAt !== null,
    logoUrl: publicStorageUrl('business-branding', b.logoPath),
    coverImageUrl: publicStorageUrl('business-branding', coverImagePath),
    storefrontUrl: storeSlug ? `/stores/${storeSlug}` : null,
  }))
}

export interface MarketplaceProduct {
  id: string
  name: string
  slug: string
  unitSize: string | null
  description: string | null
  imageUrl: string | null
  price: { amount: string; currency: string; decimal: string }
  /**
   * When the merchant published it to Musuwo, not when the row was created.
   *
   * Freshness in the feed means "new to shoppers here", and a product may have
   * sat in a merchant's own shop for months before they consented to list it.
   * Serialised as an ISO string because this payload crosses into client
   * components, where a Date does not survive the boundary intact.
   */
  publishedAt: string | null
  merchant: {
    publicId: string
    name: string
    slug: string
    /** RETAIL, FOOD, SERVICE and so on. Drives the category filter. */
    kind: string
    logoPath: string | null
    /** Resolved from logoPath. A path is not a src - see publicStorageUrl. */
    logoUrl: string | null
    websiteUrl: string | null
    whatsappNumber: string | null
    faviconPath: string | null
    storefrontUrl: string | null
    /** Whether Musuwo has seen this merchant's licence. See PublicBusiness. */
    verified: boolean
  }
}

/**
 * The marketplace catalogue.
 *
 * FOUR CONDITIONS, ALL REQUIRED. A product appears only when it is active, not
 * deleted, explicitly published to Musuwo, AND its business is publicly
 * visible. Dropping any one of them publishes something somebody did not agree
 * to publish:
 *
 *   isActive              on sale in the merchant's own shop
 *   deletedAt is null     not retired
 *   publishToMusuwo       the merchant consented to the marketplace
 *   business is public    the merchant is approved and not suspended
 *
 * Suspending a business therefore removes its products from Musuwo on the next
 * read, without touching the merchant's own catalogue.
 *
 * The canonical product row is read directly - nothing is copied - so a price
 * or photo change on the merchant's side shows here immediately.
 *
 * `costPriceAmount` is deliberately not selected. It is what the shop paid,
 * and it must never reach a customer-facing response.
 */
export async function listMarketplaceProducts(): Promise<MarketplaceProduct[]> {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      unitSize: products.unitSize,
      description: products.description,
      priceAmount: products.priceAmount,
      priceCurrency: products.priceCurrency,
      promoPriceAmount: products.promoPriceAmount,
      publishedToMusuwoAt: products.publishedToMusuwoAt,
      merchantPublicId: businesses.publicId,
      merchantName: businesses.name,
      merchantSlug: businesses.slug,
      merchantKind: businesses.kind,
      merchantLogo: businesses.logoPath,
      merchantWebsite: businesses.websiteUrl,
      merchantWhatsapp: businesses.whatsappNumber,
      merchantFavicon: businesses.faviconPath,
      merchantVerifiedAt: businesses.verifiedAt,
      imagePath: sql<string | null>`(
        select pi.path from product_images pi
        where pi.product_id = ${products.id}
        order by pi.sort_order asc, pi.created_at asc limit 1
      )`,
      storeSlug: stores.slug,
    })
    .from(products)
    .innerJoin(businesses, eq(businesses.storeId, products.storeId))
    .leftJoin(stores, eq(stores.id, businesses.storeId))
    .where(
      and(
        eq(products.isActive, true),
        isNull(products.deletedAt),
        eq(products.publishToMusuwo, true),
        inArray(businesses.status, [...PUBLIC_STATUSES]),
        isNull(businesses.deletedAt),
      ),
    )
    .orderBy(asc(products.name))

  return rows.map((r) => {
    // The promotional price is what the customer would actually pay, so it is
    // what the marketplace must show. Null is not zero.
    const amount = r.promoPriceAmount ?? r.priceAmount
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      unitSize: r.unitSize,
      description: r.description,
      imageUrl: r.imagePath
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-photos/${r.imagePath}`
        : null,
      price: {
        amount: amount.toString(),
        currency: r.priceCurrency,
        decimal: (Number(amount) / 100).toFixed(2),
      },
      publishedAt: r.publishedToMusuwoAt?.toISOString() ?? null,
      merchant: {
        publicId: r.merchantPublicId,
        name: r.merchantName,
        slug: r.merchantSlug,
        kind: r.merchantKind,
        logoPath: r.merchantLogo,
        logoUrl: publicStorageUrl('business-branding', r.merchantLogo),
        websiteUrl: r.merchantWebsite,
        whatsappNumber: r.merchantWhatsapp,
        faviconPath: r.merchantFavicon,
        storefrontUrl: r.storeSlug ? `/stores/${r.storeSlug}` : null,
        // A boolean only. The licence number and document stay server-side.
        verified: r.merchantVerifiedAt !== null,
      },
    }
  })
}

/** Record a view only for an authenticated customer. Anonymous browsing never
 * creates a shadow profile. */
export async function recordMarketplaceProductView(userId: string, productId: string) {
  await db.insert(marketplaceProductViews).values({ userId, productId })
}

export async function getMarketplaceProduct(merchantSlug: string, productSlug: string) {
  const all = await listMarketplaceProducts()
  return all.find((product) => product.merchant.slug === merchantSlug && product.slug === productSlug) ?? null
}

export async function getPublicBusiness(slug: string): Promise<PublicBusiness | null> {
  const all = await listPublicBusinesses()
  return all.find((business) => business.slug === slug) ?? null
}

/** Recommendations require actual history. A new account receives an empty
 * list rather than the founding merchant being presented as personalised. */
export async function listRecommendedProducts(userId: string): Promise<MarketplaceProduct[]> {
  const viewed = await db
    .select({ productId: marketplaceProductViews.productId })
    .from(marketplaceProductViews)
    .where(eq(marketplaceProductViews.userId, userId))
    .orderBy(desc(marketplaceProductViews.viewedAt))
    .limit(50)
  if (viewed.length === 0) return []

  const viewedIds = new Set(viewed.map((row) => row.productId))
  const all = await listMarketplaceProducts()
  const merchantSlugs = new Set(
    all.filter((product) => viewedIds.has(product.id)).map((product) => product.merchant.slug),
  )
  return all
    .filter((product) => merchantSlugs.has(product.merchant.slug) && !viewedIds.has(product.id))
    .slice(0, 24)
}

/* ---------------------------------------------------------------- writes */

/**
 * Publish or unpublish one product to the marketplace.
 *
 * Scoped by BOTH the product id and the caller's business, so a merchant
 * cannot publish or withdraw a product belonging to somebody else. The
 * membership check happens first; the update then filters on the business's
 * own store, which means a forged product id simply matches nothing.
 */
export async function setProductPublication(
  params: { userId: string; businessId: string; productId: string; publish: boolean },
  tx: DbOrTx = db,
): Promise<void> {
  const membership = await requireMembership(params.userId, params.businessId, {
    write: true,
  })

  if (!membership.storeId) {
    throw new MarketplaceError(
      'NOT_FOUND',
      'That business has no catalogue of its own.',
    )
  }

  const updated = await tx
    .update(products)
    .set({
      publishToMusuwo: params.publish,
      publishedToMusuwoAt: params.publish ? new Date() : null,
      publishedToMusuwoBy: params.publish ? params.userId : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(products.id, params.productId),
        // The isolation clause. Without it, a product id from another
        // merchant's catalogue would be updated by whoever guessed it.
        eq(products.storeId, membership.storeId),
        isNull(products.deletedAt),
      ),
    )
    .returning({ id: products.id })

  if (updated.length === 0) {
    throw new MarketplaceError('NOT_FOUND', 'No such product in this business.')
  }

  await tx.insert(auditLog).values({
    storeId: membership.storeId,
    actorId: params.userId,
    actorRole: 'ADMIN',
    action: params.publish ? 'PRODUCT_PUBLISHED_TO_MUSUWO' : 'PRODUCT_WITHDRAWN_FROM_MUSUWO',
    entityType: 'product',
    entityId: params.productId,
    changes: { businessId: params.businessId, publishToMusuwo: params.publish },
  })

  // Drop the public catalogue so the change is visible on the next request.
  // Without this a merchant publishes a product, sees nothing happen, and
  // publishes it again. Imported lazily because this service is also called
  // from verification scripts running outside a Next request, where
  // revalidateTag has no context and throws.
  await invalidatePublicFeeds('products')
}

/**
 * Drop the cached public feeds, tolerating the case where there is no cache.
 *
 * `revalidateTag` only works inside a Next request. The verification scripts
 * call these services directly from a plain node process, where it throws -
 * and a cache that cannot be dropped is not a reason to fail the write that
 * has already committed.
 */
async function invalidatePublicFeeds(
  scope: 'businesses' | 'products' | 'all',
): Promise<void> {
  try {
    const { revalidateMarketplace } = await import('./marketplace-cache')
    revalidateMarketplace(scope)
  } catch {
    // Outside a request context. The 300-second backstop covers it.
  }
}

/**
 * Move a business through its lifecycle.
 *
 * PLATFORM AUTHORITY, NOT BUSINESS AUTHORITY. A business owner cannot approve
 * their own business, which is why this takes no membership and must be called
 * only from a platform-admin route.
 *
 * Approving drops both public feeds, so a newly approved business and its
 * products appear on the website and in the app on their next fetch, with no
 * redeploy of either. Suspending does the same in reverse.
 */
export async function setBusinessStatus(params: {
  businessId: string
  status:
    | 'UNDER_REVIEW'
    | 'NEEDS_INFORMATION'
    | 'APPROVED'
    | 'PILOT'
    | 'ACTIVE'
    | 'PAUSED'
    | 'SUSPENDED'
    | 'REJECTED'
    | 'INACTIVE'
  reviewerId: string
  note?: string
}): Promise<void> {
  const [existing] = await db
    .select({ id: businesses.id, storeId: businesses.storeId })
    .from(businesses)
    .where(and(eq(businesses.id, params.businessId), isNull(businesses.deletedAt)))

  if (!existing) throw new MarketplaceError('NOT_FOUND', 'No such business.')

  await db
    .update(businesses)
    .set({
      status: params.status,
      // The database CHECK refuses APPROVED, PILOT or ACTIVE without a
      // reviewer, so this is recorded on every transition rather than only
      // the approving ones.
      reviewedBy: params.reviewerId,
      reviewedAt: new Date(),
      reviewNote: params.note ?? null,
      updatedAt: new Date(),
    })
    .where(eq(businesses.id, params.businessId))

  if (existing.storeId) {
    await db.insert(auditLog).values({
      storeId: existing.storeId,
      actorId: params.reviewerId,
      actorRole: 'ADMIN',
      action: 'BUSINESS_STATUS_CHANGED',
      entityType: 'business',
      entityId: params.businessId,
      changes: { status: params.status, note: params.note ?? null },
    })
  }

  await invalidatePublicFeeds('all')
}

/**
 * Apply to join the marketplace.
 *
 * Creates an APPLICATION, never a business. Approval is a separate, deliberate
 * act by a platform administrator - there is no self-service route to being
 * listed, for the same reason there is no self-service route to staff access.
 */
export async function applyForBusiness(params: {
  applicantId: string
  businessName: string
  kind?: 'RETAIL' | 'FOOD' | 'ACCOMMODATION' | 'SERVICE' | 'OTHER'
  city?: string
  contactPhone?: string
  contactEmail?: string
  note?: string
}): Promise<{ id: string }> {
  const [open] = await db
    .select({ id: businessApplications.id })
    .from(businessApplications)
    .where(
      and(
        eq(businessApplications.applicantId, params.applicantId),
        inArray(businessApplications.status, [
          'SUBMITTED',
          'UNDER_REVIEW',
          'NEEDS_INFORMATION',
        ]),
      ),
    )

  if (open) {
    throw new MarketplaceError(
      'ALREADY_APPLIED',
      'There is already an application from this account waiting for review.',
    )
  }

  const [row] = await db
    .insert(businessApplications)
    .values({
      applicantId: params.applicantId,
      businessName: params.businessName.trim(),
      kind: params.kind ?? 'RETAIL',
      city: params.city ?? 'Mutare',
      contactPhone: params.contactPhone ?? null,
      contactEmail: params.contactEmail ?? null,
      note: params.note ?? null,
      status: 'SUBMITTED',
    })
    .returning({ id: businessApplications.id })

  return row
}

/** How many businesses are publicly visible. Used by the home carousel. */
export async function countPublicBusinesses(): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(businesses)
    .where(
      and(
        inArray(businesses.status, [...PUBLIC_STATUSES]),
        isNull(businesses.deletedAt),
      ),
    )
  return n
}
