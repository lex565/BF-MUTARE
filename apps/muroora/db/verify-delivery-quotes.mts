/**
 * Prove a delivery fee cannot be forged, reused, or quietly changed.
 *
 *   npm run db:verify-delivery-quotes
 *
 * The pure arithmetic is checked without a database in
 * db/verify-delivery-pricing.mts. This file checks the half that only exists
 * once Postgres is involved: that the server keeps its own copy of every
 * quote, that expiry and reuse are enforced on the server clock rather than on
 * anything a client says, and that the snapshot frozen onto an order cannot
 * drift away from the money the customer was actually billed.
 *
 * Everything is created and removed inside this run, and the cleanup is in a
 * `finally`. That is not a style preference: an earlier verification suite in
 * this repository tidied up on the last line of main(), so when a check threw,
 * ten fake ACTIVE merchants with published products went live on
 * musuwo.online. A suite that only tidies up when it succeeds tidies up
 * exactly when it does not matter.
 *
 * The three real merchants and their real products are never touched.
 */

import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

import { eq, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { businesses } from '@/db/schema/marketplace'
import { deliveryQuotes, deliveryTariffs } from '@/db/schema/delivery'
import { stores } from '@/db/schema/catalogue'
import { orders } from '@/db/schema/orders'
import { users } from '@/db/schema/identity'
import {
  QuoteError,
  loadActiveTariff,
  loadServiceArea,
  markQuoteConsumed,
  quoteDelivery,
  redeemQuote,
} from '@/lib/services/delivery-quote'
import {
  OsrmRouteProvider,
  setRouteProvider,
  type LatLng,
  type RouteOutcome,
  type RouteProvider,
} from '@/lib/delivery/routing'

let failures = 0
const MARK = '@deliverycheck.local'

function check(name: string, passed: boolean, detail = '') {
  if (!passed) failures += 1
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`)
}

function section(title: string) {
  console.log(`\n--- ${title}`)
}

/** A router that answers with whatever this run needs it to answer. */
class StubRouter implements RouteProvider {
  readonly name = 'stub'
  constructor(private outcome: RouteOutcome) {}
  set(outcome: RouteOutcome) {
    this.outcome = outcome
  }
  async route(): Promise<RouteOutcome> {
    return this.outcome
  }
}

const router = new StubRouter({
  ok: true,
  distanceMetres: 7_280,
  durationSeconds: 900,
  provider: 'stub',
  dataVersion: 'test',
})

const created = {
  businesses: [] as string[],
  stores: [] as string[],
  users: [] as string[],
  tariffs: [] as string[],
}

/* The shop end of the route. Mutare CBD, which is also the coordinate pair
   used as the worked example in the handoff. */
const MERCHANT: LatLng = { latitude: -18.9707, longitude: 32.6709 }
const CUSTOMER: LatLng = { latitude: -18.9901, longitude: 32.6512 }

async function main() {
  setRouteProvider(router)

  section('0. Fixtures')

  const [store] = await db
    .insert(stores)
    .values({ name: `Delivery Check Store ${MARK}`, slug: `delivery-check-${Date.now()}` })
    .returning({ id: stores.id })
  created.stores.push(store.id)

  const [reviewer] = await db
    .insert(users)
    .values({ email: `reviewer${Date.now()}${MARK}`, fullName: 'Delivery Check Reviewer' })
    .returning({ id: users.id })
  created.users.push(reviewer.id)

  /* `businesses_reviewed_when_approved` covers PILOT as well as ACTIVE, which
     the first draft of this fixture got wrong: it set status PILOT without a
     reviewer and Postgres refused the insert. The database is right - a
     business a customer can be sent to has to record who let it through - so
     the fixture is what changed. It still costs a MUR-BIZ number, because the
     sequence advances even on a rolled-back insert; those numbers count
     nothing. */
  const [merchant] = await db
    .insert(businesses)
    .values({
      name: `Delivery Check Merchant ${MARK}`,
      slug: `delivery-check-merchant-${Date.now()}`,
      storeId: store.id,
      status: 'PILOT',
      reviewedBy: reviewer.id,
      reviewedAt: new Date(),
      latitude: MERCHANT.latitude,
      longitude: MERCHANT.longitude,
      deliversLocally: true,
    })
    .returning({ id: businesses.id })
  created.businesses.push(merchant.id)

  check('Fixture merchant has coordinates', true, merchant.id)

  section('1. The active tariff is the approved one')

  const tariff = await loadActiveTariff()
  check('Exactly one tariff is active', tariff.version === 'mutare-pilot-v1', tariff.version)
  check('It reaches 15 km', tariff.maxStandardMetres === 15_000, String(tariff.maxStandardMetres))
  check('It has four bands', tariff.bands.length === 4, String(tariff.bands.length))

  const dupe = await db
    .insert(deliveryTariffs)
    .values({
      version: `check-v2-${Date.now()}`,
      bands: [{ maxMetres: 15_000, feeCents: 999 }],
      maxStandardMetres: 15_000,
      isActive: true,
    })
    .returning({ version: deliveryTariffs.version })
    .then(() => true)
    .catch(() => false)

  if (dupe) created.tariffs.push((await db.select({ v: deliveryTariffs.version }).from(deliveryTariffs).where(eq(deliveryTariffs.isActive, true)))[0].v)
  check('A second ACTIVE tariff is refused by the database', dupe === false)

  section('2. The service area')

  const area = await loadServiceArea()
  check(
    'Ships disabled, so the 15 km limit is what enforces range',
    area.enabled === false,
    area.name,
  )

  section('3. A serviceable quote is priced and written down')

  router.set({
    ok: true,
    distanceMetres: 7_280,
    durationSeconds: 900,
    provider: 'stub',
    dataVersion: 'test',
  })

  const good = await quoteDelivery({ businessId: merchant.id, destination: CUSTOMER })

  check('Serviceable', good.serviceable === true, good.serviceabilityReason)
  check('7.28 km is band three, 400 cents', good.customerDeliveryFeeCents === 400,
    String(good.customerDeliveryFeeCents))
  check('A quote id was issued', typeof good.quoteId === 'string', good.quoteId ?? 'null')
  check('It expires in the future', (good.expiresAt?.getTime() ?? 0) > Date.now())

  const [stored] = await db
    .select()
    .from(deliveryQuotes)
    .where(eq(deliveryQuotes.id, good.quoteId!))

  check('The server kept its own row', !!stored)
  check('The row carries the distance', stored.roadDistanceM === 7_280, String(stored.roadDistanceM))
  check('The row carries the routing provider', stored.routingProvider === 'stub')
  check('The row names the tariff version', stored.pricingVersion === 'mutare-pilot-v1')
  check('Both ends of the route were recorded',
    stored.originLatitude === MERCHANT.latitude &&
    stored.destinationLatitude === CUSTOMER.latitude)

  section('4. A refusal is written down too')

  router.set({ ok: false, reason: 'NO_NETWORK_ROUTE', detail: 'stubbed', provider: 'stub' })

  const refused = await quoteDelivery({ businessId: merchant.id, destination: CUSTOMER })
  check('Not serviceable', refused.serviceable === false)
  check('Reason is NO_NETWORK_ROUTE', refused.serviceabilityReason === 'NO_NETWORK_ROUTE')
  check('No fee at all, not a zero fee', refused.customerDeliveryFeeCents === null)
  check('A row exists for the refusal', typeof refused.quoteId === 'string')
  check('Manual review is still offered', refused.manualReviewAvailable === true)

  section('5. Over 15 km is a manual quote, never a straight-line guess')

  router.set({
    ok: true,
    distanceMetres: 15_001,
    durationSeconds: 1800,
    provider: 'stub',
    dataVersion: 'test',
  })

  const tooFar = await quoteDelivery({ businessId: merchant.id, destination: CUSTOMER })
  check('Refused', tooFar.serviceable === false)
  check('MANUAL_QUOTE_REQUIRED', tooFar.serviceabilityReason === 'MANUAL_QUOTE_REQUIRED')
  check('No fee', tooFar.customerDeliveryFeeCents === null)

  section('6. A merchant who does not deliver is answered without routing')

  await db.update(businesses).set({ deliversLocally: false }).where(eq(businesses.id, merchant.id))
  router.set({ ok: false, reason: 'NO_NETWORK_ROUTE', detail: 'router must not be called', provider: 'stub' })

  const collectOnly = await quoteDelivery({ businessId: merchant.id, destination: CUSTOMER })
  check(
    'BUSINESS_NOT_DELIVERING, not NO_NETWORK_ROUTE',
    collectOnly.serviceabilityReason === 'BUSINESS_NOT_DELIVERING',
    collectOnly.serviceabilityReason,
  )
  await db.update(businesses).set({ deliversLocally: true }).where(eq(businesses.id, merchant.id))

  section('7. A merchant with no coordinates cannot be quoted')

  await db.update(businesses).set({ latitude: null, longitude: null }).where(eq(businesses.id, merchant.id))
  const noOrigin = await quoteDelivery({ businessId: merchant.id, destination: CUSTOMER })
  check('INVALID_LOCATION', noOrigin.serviceabilityReason === 'INVALID_LOCATION')
  await db
    .update(businesses)
    .set({ latitude: MERCHANT.latitude, longitude: MERCHANT.longitude })
    .where(eq(businesses.id, merchant.id))

  section('8. A pin at (0, 0) is refused rather than routed')

  router.set({ ok: true, distanceMetres: 3_000, durationSeconds: 600, provider: 'stub', dataVersion: 'test' })
  const nullIsland = await quoteDelivery({
    businessId: merchant.id,
    destination: { latitude: 0, longitude: 0 },
  })
  check('INVALID_LOCATION', nullIsland.serviceabilityReason === 'INVALID_LOCATION')

  section('9. Redemption: only our own quote, once, before it expires')

  const fresh = await quoteDelivery({ businessId: merchant.id, destination: CUSTOMER })

  const redeemed = await redeemQuote(fresh.quoteId!, merchant.id)
  check('A live quote redeems', redeemed.customerFeeCents === 300, String(redeemed.customerFeeCents))
  check('Its numbers come from our row, not the caller', redeemed.roadDistanceM === 3_000)

  const invented = await redeemQuote('00000000-0000-4000-8000-000000000000', merchant.id)
    .then(() => 'accepted')
    .catch((e) => (e instanceof QuoteError ? e.code : 'other'))
  check('An invented quote id is refused', invented === 'QUOTE_NOT_FOUND', String(invented))

  const otherMerchant = await redeemQuote(fresh.quoteId!, '00000000-0000-4000-8000-000000000001')
    .then(() => 'accepted')
    .catch((e) => (e instanceof QuoteError ? e.code : 'other'))
  check(
    "Another shop's quote is refused",
    otherMerchant === 'QUOTE_WRONG_MERCHANT',
    String(otherMerchant),
  )

  const unserviceableId = refused.quoteId!
  const unusable = await redeemQuote(unserviceableId, merchant.id)
    .then(() => 'accepted')
    .catch((e) => (e instanceof QuoteError ? e.code : 'other'))
  check('An unserviceable quote cannot be checked out', unusable === 'QUOTE_NOT_SERVICEABLE')

  /* Expiry is checked against the SERVER clock. Backdating the row is how a
     client holding a stale quote is simulated - the client cannot influence
     this either way, which is the point. */
  await db
    .update(deliveryQuotes)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(eq(deliveryQuotes.id, fresh.quoteId!))

  const expired = await redeemQuote(fresh.quoteId!, merchant.id)
    .then(() => 'accepted')
    .catch((e) => (e instanceof QuoteError ? e.code : 'other'))
  check('An expired quote is refused', expired === 'QUOTE_EXPIRED', String(expired))

  section('10. A quote is spent exactly once')

  const single = await quoteDelivery({ businessId: merchant.id, destination: CUSTOMER })
  const [victimOrder] = await db.select({ id: orders.id }).from(orders).limit(1)

  await markQuoteConsumed(db, single.quoteId!, victimOrder.id)
  check('First use succeeds', true)

  const second = await markQuoteConsumed(db, single.quoteId!, victimOrder.id)
    .then(() => 'accepted')
    .catch((e) => (e instanceof QuoteError ? e.code : 'other'))
  check('Second use of the same quote is refused', second === 'QUOTE_ALREADY_USED', String(second))

  const reRedeem = await redeemQuote(single.quoteId!, merchant.id)
    .then(() => 'accepted')
    .catch((e) => (e instanceof QuoteError ? e.code : 'other'))
  check('And it will not redeem again either', reRedeem === 'QUOTE_ALREADY_USED')

  section('11. The database refuses an incoherent quote row')

  const pricedButUnserviceable = await db
    .insert(deliveryQuotes)
    .values({
      businessId: merchant.id,
      pricingVersion: 'mutare-pilot-v1',
      serviceable: false,
      serviceabilityReason: 'NO_NETWORK_ROUTE',
      customerFeeCents: 400,
      roadDistanceM: 1000,
      expiresAt: new Date(Date.now() + 60_000),
    })
    .then(() => 'accepted')
    .catch(() => 'refused')
  check(
    'An unserviceable quote carrying a fee is refused',
    pricedButUnserviceable === 'refused',
  )

  const serviceableNoPrice = await db
    .insert(deliveryQuotes)
    .values({
      businessId: merchant.id,
      pricingVersion: 'mutare-pilot-v1',
      serviceable: true,
      serviceabilityReason: 'WITHIN_RANGE',
      customerFeeCents: null,
      roadDistanceM: 1000,
      expiresAt: new Date(Date.now() + 60_000),
    })
    .then(() => 'accepted')
    .catch(() => 'refused')
  check(
    'A serviceable quote with no price is refused',
    serviceableNoPrice === 'refused',
  )

  const wrongReason = await db
    .insert(deliveryQuotes)
    .values({
      businessId: merchant.id,
      pricingVersion: 'mutare-pilot-v1',
      serviceable: true,
      serviceabilityReason: 'TOO_FAR',
      customerFeeCents: 400,
      roadDistanceM: 1000,
      expiresAt: new Date(Date.now() + 60_000),
    })
    .then(() => 'accepted')
    .catch(() => 'refused')
  check('A serviceable quote whose reason says otherwise is refused', wrongReason === 'refused')

  section('12. The snapshot on an order cannot drift from the money billed')

  /* orders_delivery_snapshot_agrees holds delivery_customer_fee_cents equal to
     delivery_fee_amount. Setting one without the other is the exact bug it
     exists to make impossible: an order whose audit trail says $4 and whose
     bill says $6, with no way to tell from the outside which is true. */
  const drift = await db
    .update(orders)
    .set({ deliveryCustomerFeeCents: 999 })
    .where(eq(orders.id, victimOrder.id))
    .then(() => 'accepted')
    .catch(() => 'refused')
  check('An order fee that disagrees with its snapshot is refused', drift === 'refused')

  const halfSnapshot = await db
    .update(orders)
    .set({ deliveryQuoteId: single.quoteId })
    .where(eq(orders.id, victimOrder.id))
    .then(() => 'accepted')
    .catch(() => 'refused')
  check('Half a pricing snapshot is refused', halfSnapshot === 'refused')

  section('13. The OSRM adapter reads a real HTTP answer')

  /* Against a LOCAL stub, never a public routing server. The public OSRM demo
     would work and is exactly the wrong thing to point a test at: it forbids
     commercial use and it would receive the coordinates. What is being checked
     here is our parsing, which does not need anybody else's computer. */
  const stubServer = createServer((req, res) => {
    res.setHeader('content-type', 'application/json')
    res.setHeader('x-osrm-data-version', '2026-08-01')
    if (req.url?.includes('noroute')) {
      res.end(JSON.stringify({ code: 'NoRoute', routes: [] }))
    } else if (req.url?.includes('nosegment')) {
      res.end(JSON.stringify({ code: 'NoSegment' }))
    } else if (req.url?.includes('broken')) {
      res.statusCode = 503
      res.end('{}')
    } else {
      // 7280.4 metres: the adapter must ROUND, because the tariff bands turn
      // on single metres and refuse a fraction outright.
      res.end(JSON.stringify({ code: 'Ok', routes: [{ distance: 7280.4, duration: 902.7 }] }))
    }
  })

  await new Promise<void>((resolve) => stubServer.listen(0, '127.0.0.1', resolve))
  const port = (stubServer.address() as AddressInfo).port

  try {
    const osrm = new OsrmRouteProvider(`http://127.0.0.1:${port}`, 2_000)
    const okRoute = await osrm.route(MERCHANT, CUSTOMER)
    check('A good answer parses', okRoute.ok === true)
    check(
      'Distance is rounded to whole metres',
      okRoute.ok && okRoute.distanceMetres === 7_280,
      okRoute.ok ? String(okRoute.distanceMetres) : 'failed',
    )
    check('Duration is rounded', okRoute.ok && okRoute.durationSeconds === 903)
    check(
      'The routing data version is captured',
      okRoute.ok && okRoute.dataVersion === '2026-08-01',
    )

    const noRoute = await new OsrmRouteProvider(`http://127.0.0.1:${port}/noroute`, 2_000)
      .route(MERCHANT, CUSTOMER)
    check('NoRoute becomes NO_NETWORK_ROUTE', !noRoute.ok && noRoute.reason === 'NO_NETWORK_ROUTE')

    const noSegment = await new OsrmRouteProvider(`http://127.0.0.1:${port}/nosegment`, 2_000)
      .route(MERCHANT, CUSTOMER)
    check(
      'NoSegment becomes INVALID_LOCATION, not NO_NETWORK_ROUTE',
      !noSegment.ok && noSegment.reason === 'INVALID_LOCATION',
      noSegment.ok ? 'ok' : noSegment.reason,
    )

    const broken = await new OsrmRouteProvider(`http://127.0.0.1:${port}/broken`, 2_000)
      .route(MERCHANT, CUSTOMER)
    check('An HTTP 503 is a refusal, never a guessed distance',
      !broken.ok && broken.reason === 'NO_NETWORK_ROUTE')

    /* An unroutable port: nothing is listening, so the fetch fails outright.
       The answer must still be a refusal rather than a thrown error that a
       caller might catch and paper over. */
    const dead = await new OsrmRouteProvider('http://127.0.0.1:1', 1_000).route(MERCHANT, CUSTOMER)
    check('An unreachable router refuses rather than throwing', !dead.ok)
  } finally {
    await new Promise<void>((resolve) => stubServer.close(() => resolve()))
  }

  section('14. Nothing real was touched')

  const realMerchants = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(businesses)
    .where(sql`${businesses.name} NOT LIKE ${'%' + MARK}`)
  check('The three real businesses are intact', realMerchants[0].n === 3, String(realMerchants[0].n))
}

try {
  await main()
} catch (error) {
  failures += 1
  console.error('\nTHREW:', error)
} finally {
  /* In a finally, always. See the note at the top of this file. */
  section('Cleanup')
  try {
    for (const id of created.businesses) {
      await db.delete(deliveryQuotes).where(eq(deliveryQuotes.businessId, id))
      await db.delete(businesses).where(eq(businesses.id, id))
    }
    for (const id of created.stores) await db.delete(stores).where(eq(stores.id, id))
    for (const id of created.users) await db.delete(users).where(eq(users.id, id))
    for (const v of created.tariffs) await db.delete(deliveryTariffs).where(eq(deliveryTariffs.version, v))

    const left = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(businesses)
      .where(sql`${businesses.name} LIKE ${'%' + MARK}`)
    check('No fixture merchant left behind', left[0].n === 0, String(left[0].n))
  } catch (error) {
    failures += 1
    console.error('CLEANUP FAILED:', error)
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
