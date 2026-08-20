/**
 * SERVER ONLY.
 *
 * Not enforced with the `server-only` package, deliberately. That package
 * throws the moment it is imported outside React's server condition, which
 * includes plain node - so adding it here would make this module impossible to
 * import from db/verify-*.mts, and the verify suites are how every rule on
 * this platform is proved rather than asserted.
 *
 * The guard that actually holds is structural: this module reaches @/db/client,
 * which pulls in the postgres driver, which cannot be bundled for a browser.
 * Importing it from a client component fails the build with "Can't resolve
 * 'fs'" - the same wall that keeps registration.ts out of the application form.
 * See lib/platform/provider-types.ts for the note on that.
 */
import { createHash } from 'node:crypto'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import {
  businesses,
  businessMemberships,
  productEvents,
  products,
  searchQueries,
  type discoverySurfaceEnum,
  type productEventTypeEnum,
} from '@/db/schema'
import { platformSetting } from '@/lib/platform/settings'

/**
 * Recording what customers do, in a way a merchant cannot game.
 *
 * Section 39 of the brief says analytics must not be writable from a trusted
 * client. The note at the top of this file covers why that is enforced by what
 * this module imports rather than by the `server-only` package.
 *
 * THE SHAPE OF THE CONTRACT
 *
 * A client says "I showed this product" or "somebody opened this product".
 * It does not say how many times, it does not send a count, and there is no
 * parameter here that takes a number. The server stamps the time, resolves
 * which business owns the product, decides whether the event counts, and
 * writes exactly one row. A merchant who posts `views = 1000000` is sending a
 * field that does not exist.
 *
 * WHY DEDUPLICATION IS A UNIQUE INDEX AND NOT AN `IF EXISTS` CHECK
 *
 * Two impressions of the same card can arrive milliseconds apart from a
 * rerender. A read-then-write check loses that race and writes both. The
 * unique index on `dedupe_key` cannot lose it: the second insert violates the
 * constraint and `ON CONFLICT DO NOTHING` discards it. The database is the
 * thing enforcing the rule, which is the only place it can be enforced
 * correctly.
 */

export type DiscoverySurface = (typeof discoverySurfaceEnum.enumValues)[number]
export type ProductEventType = (typeof productEventTypeEnum.enumValues)[number]

/**
 * Events that are never deduplicated.
 *
 * Two genuine orders for the same product in the same minute are two orders,
 * and collapsing them would understate a merchant's revenue. Cart removals are
 * likewise a sequence, not a state.
 */
const NEVER_DEDUPED: ReadonlySet<ProductEventType> = new Set([
  'ORDER_COMPLETED',
  'REMOVE_FROM_CART',
])

/**
 * How long the same session seeing the same thing counts as one event.
 *
 * Impressions get the configured window, because scrolling a feed up and down
 * should not manufacture exposure. Everything else gets a short window that
 * only absorbs double-fired taps and refreshes.
 */
async function dedupeWindowMinutes(eventType: ProductEventType): Promise<number> {
  if (eventType === 'PRODUCT_IMPRESSION') {
    return platformSetting('feed_impression_dedupe_minutes', 30)
  }
  return 2
}

function bucket(at: Date, minutes: number): number {
  return Math.floor(at.getTime() / (minutes * 60_000))
}

function dedupeKey(parts: {
  sessionId: string
  productId: string | null
  businessId: string
  eventType: ProductEventType
  at: Date
  minutes: number
}): string {
  return createHash('sha256')
    .update(
      [
        parts.sessionId,
        parts.productId ?? 'no-product',
        parts.businessId,
        parts.eventType,
        bucket(parts.at, parts.minutes),
      ].join('|'),
    )
    .digest('hex')
}

/**
 * Reasons an event is written but does not count.
 *
 * Kept as a named union rather than free text so the rollup and the verify
 * suite agree about the vocabulary, and so a new exclusion cannot be invented
 * quietly in one call site.
 */
export type ExclusionReason =
  | 'MERCHANT_SELF'
  | 'PLATFORM_STAFF'
  | 'PRODUCT_NOT_PUBLIC'

/**
 * Does this person work for the merchant whose product this is?
 *
 * Section 16: a merchant refreshing their own listing must not manufacture
 * demand for it. Resolved from `business_memberships`, which is the same table
 * that governs whether they may edit the product, so the two can never
 * disagree about who "they" are.
 */
async function isOwnMerchant(userId: string, businessId: string): Promise<boolean> {
  const rows = await db
    .select({ id: businessMemberships.id })
    .from(businessMemberships)
    .where(
      and(
        eq(businessMemberships.userId, userId),
        eq(businessMemberships.businessId, businessId),
      ),
    )
    .limit(1)
  return rows.length > 0
}

export type RecordEventInput = {
  eventType: ProductEventType
  /** Required for everything except a bare STORE_VISIT. */
  productId?: string | null
  /** Supply when the caller already knows it, otherwise it is resolved. */
  businessId?: string | null
  entryProductId?: string | null
  surface?: DiscoverySurface
  sessionId: string
  userId?: string | null
  /** Never a count. Free-form context only, such as the feed position. */
  metadata?: Record<string, unknown> | null
  /** Set by trusted server callers only, for example the admin preview. */
  forceExclude?: ExclusionReason | null
}

/**
 * Resolve which merchant owns a product, from the product itself.
 *
 * The caller may pass a `businessId`, but it is never trusted when a product
 * id is present: a client that could name both could attribute its own
 * impressions to a competitor, or a competitor's orders to itself. The product
 * decides.
 */
async function ownerOf(productId: string): Promise<{
  businessId: string
  isPublic: boolean
} | null> {
  const rows = await db
    .select({
      businessId: businesses.id,
      isActive: products.isActive,
      published: products.publishToMusuwo,
      deletedAt: products.deletedAt,
    })
    .from(products)
    .innerJoin(businesses, eq(businesses.storeId, products.storeId))
    .where(eq(products.id, productId))
    .limit(1)

  const row = rows[0]
  if (!row) return null
  return {
    businessId: row.businessId,
    isPublic: row.isActive && row.published && row.deletedAt === null,
  }
}

/**
 * Write one event.
 *
 * Returns whether a row was actually created, which is what the verify suite
 * asserts on and what makes "the rerender did not count" testable rather than
 * a claim.
 */
export async function recordEvent(input: RecordEventInput): Promise<{
  written: boolean
  excluded: ExclusionReason | null
}> {
  const at = new Date()

  let businessId = input.businessId ?? null
  let excluded: ExclusionReason | null = input.forceExclude ?? null

  if (input.productId) {
    const owner = await ownerOf(input.productId)
    if (!owner) return { written: false, excluded: null }
    // The product decides, never the caller. See ownerOf.
    businessId = owner.businessId
    if (!owner.isPublic && !excluded) excluded = 'PRODUCT_NOT_PUBLIC'
  }

  if (!businessId) return { written: false, excluded: null }

  if (!excluded && input.userId && (await isOwnMerchant(input.userId, businessId))) {
    excluded = 'MERCHANT_SELF'
  }

  const minutes = await dedupeWindowMinutes(input.eventType)
  const key = NEVER_DEDUPED.has(input.eventType)
    ? null
    : dedupeKey({
        sessionId: input.sessionId,
        productId: input.productId ?? null,
        businessId,
        eventType: input.eventType,
        at,
        minutes,
      })

  const inserted = await db
    .insert(productEvents)
    .values({
      eventType: input.eventType,
      surface: input.surface ?? 'OTHER',
      productId: input.productId ?? null,
      businessId,
      entryProductId: input.entryProductId ?? null,
      userId: input.userId ?? null,
      sessionId: input.sessionId,
      excludedReason: excluded,
      dedupeKey: key,
      occurredAt: at,
      metadata: input.metadata ?? null,
    })
    /**
     * The index this infers is deliberately NOT partial - see migration
     * 0021. A partial one cannot be inferred from a bare target, and rows with
     * a null key are exempt anyway because Postgres treats NULLs as distinct.
     */
    .onConflictDoNothing({ target: productEvents.dedupeKey })
    .returning({ id: productEvents.id })

  return { written: inserted.length > 0, excluded }
}

/**
 * Record a batch of impressions from one feed page.
 *
 * The feed reports what became visible in one go rather than one request per
 * card. That is a bandwidth decision as much as anything: a customer on a
 * metered connection in Mutare should not pay for twenty-four HTTP requests to
 * tell us their screen scrolled.
 */
export async function recordImpressions(params: {
  productIds: string[]
  surface: DiscoverySurface
  sessionId: string
  userId?: string | null
}): Promise<{ written: number }> {
  // A page cannot report more impressions than a page can hold. Without this a
  // caller could post ten thousand ids in one request; they would each be
  // deduplicated, but the server would still do ten thousand lookups.
  const pageSize = await platformSetting('feed_page_size', 24)
  const capped = [...new Set(params.productIds)].slice(0, pageSize * 2)
  if (capped.length === 0) return { written: 0 }

  let written = 0
  for (const productId of capped) {
    const result = await recordEvent({
      eventType: 'PRODUCT_IMPRESSION',
      productId,
      surface: params.surface,
      sessionId: params.sessionId,
      userId: params.userId ?? null,
    })
    if (result.written) written += 1
  }
  return { written }
}

/** Normalise for grouping. Lossy on purpose, which is why the raw text is kept. */
export function normaliseQuery(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function recordSearch(params: {
  query: string
  resultCount: number
  surface?: DiscoverySurface
  sessionId: string
  userId?: string | null
}): Promise<void> {
  const normalised = normaliseQuery(params.query)
  // A single character is a keystroke, not a search. Logging those would fill
  // the market-gap report with the letter "s".
  if (normalised.length < 2) return

  await db.insert(searchQueries).values({
    queryRaw: params.query.slice(0, 200),
    queryNormalised: normalised.slice(0, 200),
    resultCount: params.resultCount,
    surface: params.surface ?? 'SEARCH',
    sessionId: params.sessionId,
    userId: params.userId ?? null,
  })
}

/**
 * Products this session has already been shown, so the feed can stop repeating
 * itself. Impressions only, and only ones that counted.
 */
export async function recentlySeen(
  sessionId: string,
  limit = 200,
): Promise<Set<string>> {
  const rows = await db
    .select({ productId: productEvents.productId })
    .from(productEvents)
    .where(
      and(
        eq(productEvents.sessionId, sessionId),
        eq(productEvents.eventType, 'PRODUCT_IMPRESSION'),
        isNull(productEvents.excludedReason),
      ),
    )
    .orderBy(sql`${productEvents.occurredAt} desc`)
    .limit(limit)

  return new Set(rows.map((r) => r.productId).filter((v): v is string => v !== null))
}

/** Products this account has opened, newest first. Signed-in customers only. */
export async function viewedProductIds(
  userId: string,
  limit = 50,
): Promise<string[]> {
  const rows = await db
    .select({ productId: productEvents.productId })
    .from(productEvents)
    .where(
      and(
        eq(productEvents.userId, userId),
        inArray(productEvents.eventType, ['PRODUCT_VIEW', 'ADD_TO_CART']),
        isNull(productEvents.excludedReason),
      ),
    )
    .orderBy(sql`${productEvents.occurredAt} desc`)
    .limit(limit)

  return rows.map((r) => r.productId).filter((v): v is string => v !== null)
}
