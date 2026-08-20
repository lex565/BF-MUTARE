/**
 * Prove the feed cannot be gamed and the numbers cannot be inflated.
 *
 *   npm run db:verify-discovery
 *
 * WHY THIS EXISTS. Ranking decides which merchant gets seen, and analytics
 * decide what merchants believe about their own business. Both are worth
 * cheating, and neither has a customer to notice when it goes wrong. So every
 * rule the brief asks for is broken here deliberately and the breakage is
 * asserted, rather than reasoned about in a comment.
 *
 * Everything is created and removed inside this run. Real pilot data - three
 * merchants, two real products, ten cancelled orders - is never touched, and
 * the last check proves nothing was left behind.
 */

import { and, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { users } from '@/db/schema/identity'
import { stores, products, categories } from '@/db/schema/catalogue'
import { businesses, businessMemberships } from '@/db/schema/marketplace'
import { productEvents, productAnalyticsDaily, merchantAnalyticsDaily, searchQueries } from '@/db/schema/analytics'
import { recordEvent, recordImpressions, recordSearch } from '@/lib/services/discovery-events'
import { rollUpProducts, rollUpMerchants } from '@/lib/services/analytics-rollup'
import { interleaveByMerchant } from '@/lib/services/for-you'

let failures = 0
const MARK = '@feedcheck.local'

function check(name: string, passed: boolean, detail = '') {
  if (!passed) failures += 1
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`)
}

function section(title: string) {
  console.log(`\n--- ${title}`)
}

const created = {
  users: [] as string[],
  businesses: [] as string[],
  stores: [] as string[],
  products: [] as string[],
}

/**
 * `reviewedBy` and `reviewedAt` are not optional here.
 *
 * The first version of this fixture inserted an ACTIVE business without them
 * and Postgres refused it: `businesses_reviewed_when_approved` requires that
 * an approved business records who approved it and when. That is the platform
 * working correctly - a merchant cannot become live without a person's name
 * against the decision - so the fixture is what had to change.
 */
async function makeMerchant(name: string, slug: string, reviewerId: string) {
  const [store] = await db
    .insert(stores)
    .values({ name, slug })
    .returning({ id: stores.id })
  created.stores.push(store.id)

  const [business] = await db
    .insert(businesses)
    .values({
      name,
      slug,
      storeId: store.id,
      status: 'ACTIVE',
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    })
    .returning({ id: businesses.id })
  created.businesses.push(business.id)

  const [category] = await db
    .insert(categories)
    .values({ storeId: store.id, name: 'Check', slug: `check-${slug}` })
    .returning({ id: categories.id })

  return { storeId: store.id, businessId: business.id, categoryId: category.id }
}

/**
 * `publishedToMusuwoBy` is likewise not optional.
 *
 * `products_musuwo_publication_audited` requires both audit columns whenever
 * `publish_to_musuwo` is true, so consent to appear on the marketplace always
 * carries who gave it. Another fixture assumption the database refused, and
 * another rule worth having.
 */
async function makeProduct(
  storeId: string,
  categoryId: string,
  name: string,
  slug: string,
  publisherId: string,
) {
  const [product] = await db
    .insert(products)
    .values({
      storeId,
      categoryId,
      sku: `CHK-${slug}`,
      name,
      slug,
      priceAmount: 500n,
      isActive: true,
      publishToMusuwo: true,
      publishedToMusuwoAt: new Date(),
      publishedToMusuwoBy: publisherId,
    })
    .returning({ id: products.id })
  created.products.push(product.id)
  return product.id
}

/** Publish or withdraw, keeping the audit columns consistent with the flag. */
async function setPublished(productId: string, publish: boolean, publisherId: string) {
  await db
    .update(products)
    .set({
      publishToMusuwo: publish,
      publishedToMusuwoAt: publish ? new Date() : null,
      publishedToMusuwoBy: publish ? publisherId : null,
    })
    .where(eq(products.id, productId))
}

async function countEvents(where: ReturnType<typeof eq>): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(productEvents)
    .where(where)
  return row.n
}

/**
 * Remove everything this run created.
 *
 * CALLED FROM `finally`, NOT FROM THE END OF main().
 *
 * The first version cleaned up on the last line of main(), so the moment any
 * check threw - and several did while this suite was being written - the run
 * aborted with its fixtures still in the database. Ten fake ACTIVE merchants
 * with published products ended up live on musuwo.online, indistinguishable
 * from real ones to a customer, because a test failed.
 *
 * A suite that only tidies up when it succeeds tidies up exactly when it does
 * not matter.
 */
async function cleanUp() {
  if (created.businesses.length) {
    await db.delete(productEvents).where(inArray(productEvents.businessId, created.businesses))
    await db.delete(productAnalyticsDaily).where(inArray(productAnalyticsDaily.businessId, created.businesses))
    await db.delete(merchantAnalyticsDaily).where(inArray(merchantAnalyticsDaily.businessId, created.businesses))
    await db.delete(businessMemberships).where(inArray(businessMemberships.businessId, created.businesses))
  }
  if (created.products.length) {
    await db.delete(products).where(inArray(products.id, created.products))
  }
  if (created.stores.length) {
    await db.delete(categories).where(inArray(categories.storeId, created.stores))
  }
  if (created.businesses.length) {
    await db.delete(businesses).where(inArray(businesses.id, created.businesses))
  }
  if (created.stores.length) {
    await db.delete(stores).where(inArray(stores.id, created.stores))
  }
  await db.delete(searchQueries).where(sql`${searchQueries.sessionId} like 'chk-search-%'`)
  if (created.users.length) {
    await db.delete(users).where(inArray(users.id, created.users))
  }
}

async function main() {
  const [reviewer] = await db
    .insert(users)
    .values({ fullName: 'Feed Reviewer', email: `reviewer${MARK}` })
    .returning({ id: users.id })
  created.users.push(reviewer.id)

  const [shopper] = await db
    .insert(users)
    .values({ fullName: 'Feed Shopper', email: `shopper${MARK}` })
    .returning({ id: users.id })
  created.users.push(shopper.id)

  const [merchantStaff] = await db
    .insert(users)
    .values({ fullName: 'Feed Merchant', email: `merchant${MARK}` })
    .returning({ id: users.id })
  created.users.push(merchantStaff.id)

  const a = await makeMerchant('Feed Check A', `feed-check-a-${Date.now()}`, reviewer.id)
  const b = await makeMerchant('Feed Check B', `feed-check-b-${Date.now()}`, reviewer.id)
  const productA = await makeProduct(a.storeId, a.categoryId, 'Check item A', `chk-a-${Date.now()}`, reviewer.id)
  const productB = await makeProduct(b.storeId, b.categoryId, 'Check item B', `chk-b-${Date.now()}`, reviewer.id)

  await db.insert(businessMemberships).values({
    businessId: a.businessId,
    userId: merchantStaff.id,
    role: 'BUSINESS_OWNER',
  })

  /* ================================================ impressions vs views */
  section('an impression is not a view')

  const session1 = `chk-session-1-${Date.now()}`
  await recordEvent({ eventType: 'PRODUCT_IMPRESSION', productId: productA, sessionId: session1, surface: 'FOR_YOU' })
  await recordEvent({ eventType: 'PRODUCT_VIEW', productId: productA, sessionId: session1, surface: 'FOR_YOU' })

  const impressions = await countEvents(
    and(eq(productEvents.productId, productA), eq(productEvents.eventType, 'PRODUCT_IMPRESSION'))!,
  )
  const views = await countEvents(
    and(eq(productEvents.productId, productA), eq(productEvents.eventType, 'PRODUCT_VIEW'))!,
  )
  check('they are stored as two different event types', impressions === 1 && views === 1, `${impressions} impression, ${views} view`)

  /* ======================================================= deduplication */
  section('a rerender does not become exposure')

  const before = await countEvents(
    and(eq(productEvents.productId, productA), eq(productEvents.eventType, 'PRODUCT_IMPRESSION'))!,
  )
  // Five times, as a component rerendering in a loop would.
  for (let i = 0; i < 5; i += 1) {
    await recordEvent({ eventType: 'PRODUCT_IMPRESSION', productId: productA, sessionId: session1, surface: 'FOR_YOU' })
  }
  const after = await countEvents(
    and(eq(productEvents.productId, productA), eq(productEvents.eventType, 'PRODUCT_IMPRESSION'))!,
  )
  check('five identical impressions collapse to the one already there', after === before, `${before} then ${after}`)

  const other = `chk-session-2-${Date.now()}`
  await recordEvent({ eventType: 'PRODUCT_IMPRESSION', productId: productA, sessionId: other, surface: 'FOR_YOU' })
  const afterOther = await countEvents(
    and(eq(productEvents.productId, productA), eq(productEvents.eventType, 'PRODUCT_IMPRESSION'))!,
  )
  check('a different session IS a new impression', afterOther === after + 1, `${afterOther}`)

  /* ================================================== orders never dedupe */
  section('two real orders are two orders')

  await recordEvent({ eventType: 'ORDER_COMPLETED', productId: productA, sessionId: session1 })
  await recordEvent({ eventType: 'ORDER_COMPLETED', productId: productA, sessionId: session1 })
  const orders = await countEvents(
    and(eq(productEvents.productId, productA), eq(productEvents.eventType, 'ORDER_COMPLETED'))!,
  )
  check('ORDER_COMPLETED is exempt from deduplication', orders === 2, `${orders} orders`)

  /* ================================================ merchant self-traffic */
  section('a merchant cannot manufacture demand for themselves')

  const selfSession = `chk-self-${Date.now()}`
  const selfResult = await recordEvent({
    eventType: 'PRODUCT_VIEW',
    productId: productA,
    sessionId: selfSession,
    userId: merchantStaff.id,
  })
  check('their own view is marked excluded', selfResult.excluded === 'MERCHANT_SELF', String(selfResult.excluded))

  const shopperResult = await recordEvent({
    eventType: 'PRODUCT_VIEW',
    productId: productA,
    sessionId: `chk-shopper-${Date.now()}`,
    userId: shopper.id,
  })
  check('an ordinary shopper is not excluded', shopperResult.excluded === null, String(shopperResult.excluded))

  /* ============================================= attribution is not forged */
  section('a caller cannot attribute traffic to somebody else')

  const forgedSession = `chk-forge-${Date.now()}`
  await recordEvent({
    eventType: 'PRODUCT_VIEW',
    productId: productB,
    // Deliberately naming merchant A while viewing merchant B's product.
    businessId: a.businessId,
    sessionId: forgedSession,
  })
  const [forged] = await db
    .select({ businessId: productEvents.businessId })
    .from(productEvents)
    .where(and(eq(productEvents.productId, productB), eq(productEvents.sessionId, forgedSession)))
    .limit(1)
  check(
    'ownership came from the product, not from the caller',
    forged?.businessId === b.businessId,
    forged?.businessId === a.businessId ? 'the forged id was accepted' : 'resolved correctly',
  )

  /* ================================================== unpublished products */
  section('a product nobody published does not accrue exposure')

  await setPublished(productB, false, reviewer.id)
  const hidden = await recordEvent({
    eventType: 'PRODUCT_IMPRESSION',
    productId: productB,
    sessionId: `chk-hidden-${Date.now()}`,
  })
  check('it is excluded as not public', hidden.excluded === 'PRODUCT_NOT_PUBLIC', String(hidden.excluded))
  await setPublished(productB, true, reviewer.id)

  /* ====================================================== batch impressions */
  section('a feed page reports its impressions once')

  const batchSession = `chk-batch-${Date.now()}`
  const first = await recordImpressions({
    productIds: [productA, productB, productA, productB],
    surface: 'FOR_YOU',
    sessionId: batchSession,
  })
  check('duplicates inside one batch are collapsed', first.written === 2, `${first.written} written from 4 ids`)

  const again = await recordImpressions({
    productIds: [productA, productB],
    surface: 'FOR_YOU',
    sessionId: batchSession,
  })
  check('re-sending the same page writes nothing', again.written === 0, `${again.written} written`)

  /* =========================================================== append only */
  section('analytics cannot be edited after the fact')

  let updateBlocked = false
  try {
    await db
      .update(productEvents)
      .set({ eventType: 'ORDER_COMPLETED' })
      .where(eq(productEvents.productId, productA))
  } catch {
    updateBlocked = true
  }
  check('UPDATE on product_events is refused', updateBlocked)

  /**
   * DELETE is deliberately NOT blocked. See migration 0022: blocking it made
   * every product that had ever been shown to anybody undeletable, because
   * Postgres runs ON DELETE CASCADE as an internal DELETE and the trigger
   * swallowed it. UPDATE is the tamper case and stays refused; a deletion only
   * ever reduces a merchant's own numbers and the rollup recomputes from what
   * remains.
   */
  const deletable = await db
    .delete(productEvents)
    .where(
      and(
        eq(productEvents.productId, productA),
        eq(productEvents.eventType, 'PRODUCT_SHARED'),
      ),
    )
    .then(() => true)
    .catch(() => false)
  check('DELETE is allowed, so a product can still be removed', deletable)

  /**
   * The guard from 0023 permits a referential SET NULL and refuses everything
   * else. Both halves are checked, because a guard that lets the cascade
   * through by being permissive would pass the first half on its own.
   */
  /**
   * Deliberately the merchant's own excluded view, not just any row.
   *
   * The first version of this check took `limit(1)` of the product's events,
   * which was an impression whose excluded_reason was already null. Setting it
   * to null changed nothing, the guard correctly allowed the no-op, and the
   * check reported a hole that did not exist. A test that can pass or fail on
   * which row it happened to grab is not testing anything.
   */
  const [sample] = await db
    .select({ id: productEvents.id })
    .from(productEvents)
    .where(
      and(
        eq(productEvents.productId, productA),
        eq(productEvents.excludedReason, 'MERCHANT_SELF'),
      ),
    )
    .limit(1)
  check('the merchant self-view is there to attempt to un-exclude', Boolean(sample))

  let excludedEditBlocked = false
  try {
    await db
      .update(productEvents)
      .set({ excludedReason: null })
      .where(eq(productEvents.id, sample.id))
  } catch {
    excludedEditBlocked = true
  }
  check('un-excluding an event is still refused', excludedEditBlocked)

  let surfaceEditBlocked = false
  try {
    await db
      .update(productEvents)
      .set({ userId: null, surface: 'SEARCH' })
      .where(eq(productEvents.id, sample.id))
  } catch {
    surfaceEditBlocked = true
  }
  check(
    'nulling a reference cannot smuggle another edit alongside it',
    surfaceEditBlocked,
  )

  /* ============================================================== rollups */
  section('the daily numbers are derived, and derived the same way twice')

  await rollUpProducts()
  await rollUpMerchants()

  const [firstPass] = await db
    .select()
    .from(productAnalyticsDaily)
    .where(eq(productAnalyticsDaily.productId, productA))
    .limit(1)

  check('a rollup row exists for the product', Boolean(firstPass))
  check(
    'excluded events did not reach the totals',
    firstPass ? firstPass.views === 2 : false,
    firstPass ? `views=${firstPass.views} (1 shopper + 1 forged-attribution shopper, merchant self-view excluded)` : 'no row',
  )
  check(
    'orders were counted',
    firstPass ? firstPass.orders === 2 : false,
    firstPass ? `orders=${firstPass.orders}` : 'no row',
  )

  await rollUpProducts()
  const [secondPass] = await db
    .select()
    .from(productAnalyticsDaily)
    .where(eq(productAnalyticsDaily.productId, productA))
    .limit(1)
  check(
    'running the rollup twice does not double anything',
    secondPass?.views === firstPass?.views && secondPass?.orders === firstPass?.orders,
    `${firstPass?.views}/${firstPass?.orders} then ${secondPass?.views}/${secondPass?.orders}`,
  )

  const [merchantRow] = await db
    .select()
    .from(merchantAnalyticsDaily)
    .where(eq(merchantAnalyticsDaily.businessId, a.businessId))
    .limit(1)
  check('the merchant rollup exists too', Boolean(merchantRow))

  /* ================================================== store discovery */
  section('a product that brings people into a shop gets the credit')

  await recordEvent({
    eventType: 'STORE_VISIT',
    businessId: a.businessId,
    entryProductId: productA,
    sessionId: `chk-entry-${Date.now()}`,
    surface: 'FOR_YOU',
  })
  await rollUpProducts()
  const [withEntry] = await db
    .select({ storeEntries: productAnalyticsDaily.storeEntries })
    .from(productAnalyticsDaily)
    .where(eq(productAnalyticsDaily.productId, productA))
    .limit(1)
  check('store_entries counted the doorway', withEntry?.storeEntries === 1, `${withEntry?.storeEntries}`)

  /* ==================================================== merchant diversity */
  section('one merchant cannot own the feed')

  const dominated = [
    { merchant: { slug: 'big' } },
    { merchant: { slug: 'big' } },
    { merchant: { slug: 'big' } },
    { merchant: { slug: 'big' } },
    { merchant: { slug: 'small' } },
  ]
  const mixed = interleaveByMerchant(dominated, 2)
  let longestRun = 0
  let run = 0
  let previous = ''
  for (const item of mixed) {
    run = item.merchant.slug === previous ? run + 1 : 1
    previous = item.merchant.slug
    longestRun = Math.max(longestRun, run)
  }
  check('the small merchant is lifted out of last place', mixed[2]?.merchant.slug === 'small', `order: ${mixed.map(m => m.merchant.slug).join(',')}`)
  check('nothing was dropped to achieve it', mixed.length === dominated.length, `${mixed.length} of ${dominated.length}`)

  const soloRun = interleaveByMerchant(
    [{ merchant: { slug: 'only' } }, { merchant: { slug: 'only' } }, { merchant: { slug: 'only' } }],
    2,
  )
  check(
    'with one merchant it shows everything rather than hiding stock',
    soloRun.length === 3,
    `${soloRun.length} of 3`,
  )

  /* ============================================================== search */
  section('searches are written down, keystrokes are not')

  const searchSession = `chk-search-${Date.now()}`
  await recordSearch({ query: 'School Shoes!!', resultCount: 0, sessionId: searchSession })
  await recordSearch({ query: 's', resultCount: 12, sessionId: searchSession })

  const logged = await db
    .select({ raw: searchQueries.queryRaw, normalised: searchQueries.queryNormalised })
    .from(searchQueries)
    .where(eq(searchQueries.sessionId, searchSession))

  check('the real search was logged', logged.length === 1, `${logged.length} rows`)
  check('it was normalised for grouping', logged[0]?.normalised === 'school shoes', logged[0]?.normalised)
  check('the raw text was kept as typed', logged[0]?.raw === 'School Shoes!!', logged[0]?.raw)

  /* ============================================================= cleanup */
  section('nothing was left behind')

  await cleanUp()

  const [leftEvents] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(productEvents)
    .where(inArray(productEvents.businessId, created.businesses))
  check('no check events remain', leftEvents.n === 0, `${leftEvents.n} left`)

  const [leftBusinesses] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(businesses)
    .where(sql`${businesses.slug} like 'feed-check-%'`)
  check('no check merchants remain', leftBusinesses.n === 0, `${leftBusinesses.n} left`)

  const [leftUsers] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(sql`${users.email} like ${'%' + MARK}`)
  check('no check accounts remain', leftUsers.n === 0, `${leftUsers.n} left`)
}

await main()
  .catch((error) => {
    failures += 1
    console.error('\nThe run itself failed:', error)
  })
  .finally(async () => {
    /**
     * Belt and braces. main() cleans up on the happy path; this catches the
     * run that threw halfway through, which is the one that matters.
     *
     * Ten fake ACTIVE merchants with published products reached musuwo.online
     * while this suite was being written, because the cleanup used to be the
     * last line of main() and several checks threw before reaching it. A suite
     * that only tidies up when it succeeds tidies up exactly when it does not
     * need to.
     *
     * cleanUp is idempotent, so running it twice on a successful run is free.
     */
    try {
      await cleanUp()
    } catch (error) {
      failures += 1
      console.error(
        '\nCLEANUP FAILED. Look for rows with slug like feed-check-% and remove them:',
        error,
      )
    }

    console.log(
      failures === 0
        ? '\nAll checks passed.'
        : `\n${failures} check(s) FAILED.`,
    )
    process.exit(failures === 0 ? 0 : 1)
  })
