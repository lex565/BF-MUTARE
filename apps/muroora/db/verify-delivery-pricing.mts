/**
 * Prove the delivery tariff charges exactly what was approved.
 *
 *   npm run db:verify-delivery
 *
 * Every check below is one of the automated tests named in section 10 of
 * MUSUWO_DELIVERY_PRICING_IMPLEMENTATION_HANDOFF.md, plus the boundary cases
 * around them that the handoff implies but does not spell out.
 *
 * NO DATABASE. Nothing here connects to Postgres, which is the point: pricing
 * is pure arithmetic and it should be provable on a laptop with no network and
 * no credentials. The database-facing half of delivery - quote persistence,
 * expiry, order snapshots - is checked in db/verify-delivery-quotes.mts, which
 * does need a connection.
 *
 * The band boundaries are the whole game. A delivery at exactly 2 km and one
 * at 2.001 km are a dollar apart, and a rounding mistake at that seam is worth
 * real money over a few hundred orders while looking completely reasonable in
 * a log.
 */

import {
  MUTARE_PILOT_V1,
  PRICING_VERSION,
  assertTariffSane,
  kmToMetres,
  priceQuote,
  redeliveryChargeCents,
  returnChargeCents,
  standardFeeCents,
  unserviceable,
  type Tariff,
} from '@/lib/delivery/tariff'

let failures = 0

function check(name: string, passed: boolean, detail = '') {
  if (!passed) failures += 1
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`)
}

function section(title: string) {
  console.log(`\n--- ${title}`)
}

/** The fee for a distance given in kilometres, the way the handoff states it. */
const feeForKm = (km: number) => standardFeeCents(kmToMetres(km))

section('1. The approved tariff table')

check('Tariff is internally consistent', (() => {
  try {
    assertTariffSane(MUTARE_PILOT_V1)
    return true
  } catch {
    return false
  }
})())

check(
  'Pricing version is mutare-pilot-v1',
  PRICING_VERSION === 'mutare-pilot-v1',
  PRICING_VERSION,
)

section('2. Band boundaries (handoff section 10)')

check('Exactly 2.000 km costs 200 cents', feeForKm(2.0) === 200, String(feeForKm(2.0)))
check('2.001 km costs 300 cents', feeForKm(2.001) === 300, String(feeForKm(2.001)))
check('Exactly 5.000 km costs 300 cents', feeForKm(5.0) === 300, String(feeForKm(5.0)))
check('5.001 km costs 400 cents', feeForKm(5.001) === 400, String(feeForKm(5.001)))
check('Exactly 10.000 km costs 400 cents', feeForKm(10.0) === 400, String(feeForKm(10.0)))
check('10.001 km costs 600 cents', feeForKm(10.001) === 600, String(feeForKm(10.001)))
check('Exactly 15.000 km costs 600 cents', feeForKm(15.0) === 600, String(feeForKm(15.0)))

check(
  '15.001 km has no standard fee',
  feeForKm(15.001) === null,
  String(feeForKm(15.001)),
)
check(
  '15.001 km returns MANUAL_QUOTE_REQUIRED',
  priceQuote({ roadDistanceMetres: kmToMetres(15.001) }).serviceabilityReason ===
    'MANUAL_QUOTE_REQUIRED',
)
check(
  '15.001 km carries no fee at all, not a zero fee',
  priceQuote({ roadDistanceMetres: kmToMetres(15.001) }).customerDeliveryFeeCents === null,
)

section('3. The float trap the boundaries depend on')

/* If kilometres were multiplied out and truncated, 2.001 km becomes 2000m and
   lands in the wrong band. This asserts the conversion itself, so a future
   edit to kmToMetres cannot quietly reintroduce it. */
check('kmToMetres(2.001) is 2001, not 2000', kmToMetres(2.001) === 2001, String(kmToMetres(2.001)))
check('kmToMetres(5.001) is 5001', kmToMetres(5.001) === 5001, String(kmToMetres(5.001)))
check('kmToMetres(10.001) is 10001', kmToMetres(10.001) === 10001, String(kmToMetres(10.001)))
check(
  'A fractional metre is refused rather than rounded silently',
  (() => {
    try {
      standardFeeCents(2000.5)
      return false
    } catch {
      return true
    }
  })(),
)

section('4. Zero and negative distance are not free delivery')

check('Zero metres has no standard fee', standardFeeCents(0) === null)
check(
  'Zero metres is INVALID_LOCATION, not WITHIN_RANGE',
  priceQuote({ roadDistanceMetres: 0 }).serviceabilityReason === 'INVALID_LOCATION',
)
check('Negative metres has no standard fee', standardFeeCents(-500) === null)
check('One metre still costs the first band', standardFeeCents(1) === 200)

section('5. Oversize surcharge')

const heavy = priceQuote({ roadDistanceMetres: 7_280, isHeavyOrOversized: true })
check('Heavy order adds 200 cents once', heavy.oversizeFeeCents === 200, String(heavy.oversizeFeeCents))
check(
  'Heavy 7.28 km order totals 600 cents',
  heavy.customerDeliveryFeeCents === 600,
  String(heavy.customerDeliveryFeeCents),
)
check(
  'A normal order adds no surcharge',
  priceQuote({ roadDistanceMetres: 7_280 }).oversizeFeeCents === 0,
)

section('6. Funded subsidy')

const subsidised = priceQuote({ roadDistanceMetres: 3_000, promotionSubsidyCents: 100 })
check('Subsidy reduces the customer fee', subsidised.customerDeliveryFeeCents === 200)
check('Subsidy is recorded separately', subsidised.promotionSubsidyCents === 100)

const overSubsidised = priceQuote({
  roadDistanceMetres: 3_000,
  promotionSubsidyCents: 9_999,
})
check(
  'Subsidy cannot push the customer fee below zero',
  overSubsidised.customerDeliveryFeeCents === 0,
  String(overSubsidised.customerDeliveryFeeCents),
)
check(
  'An over-large subsidy is capped at the fee, not recorded in full',
  overSubsidised.promotionSubsidyCents === 300,
  String(overSubsidised.promotionSubsidyCents),
)
check(
  'A negative subsidy cannot be used to inflate the fee',
  priceQuote({ roadDistanceMetres: 3_000, promotionSubsidyCents: -500 })
    .customerDeliveryFeeCents === 300,
)

section('7. No route is never a straight-line quote')

const noRoute = unserviceable('NO_NETWORK_ROUTE')
check('NO_NETWORK_ROUTE is not serviceable', noRoute.serviceable === false)
check('NO_NETWORK_ROUTE carries no fee', noRoute.customerDeliveryFeeCents === null)
check('NO_NETWORK_ROUTE keeps the pricing version', noRoute.pricingVersion === PRICING_VERSION)

section('8. Charges raised after checkout')

check('Return is 75% of 200 = 150', returnChargeCents(200) === 150, String(returnChargeCents(200)))
check('Return is 75% of 300 = 225', returnChargeCents(300) === 225, String(returnChargeCents(300)))
check('Return is 75% of 400 = 300', returnChargeCents(400) === 300, String(returnChargeCents(400)))
check('Return is 75% of 600 = 450', returnChargeCents(600) === 450, String(returnChargeCents(600)))
/* 350 * 0.75 = 262.5, which must round HALF UP to 263 and not down to 262. */
check(
  'Return rounds half up: 75% of 350 = 263',
  returnChargeCents(350) === 263,
  String(returnChargeCents(350)),
)

check('Redelivery is the full standard fee again', redeliveryChargeCents(400) === 400)

section('9. Waiting time')

/* Imported here rather than at the top so this section reads as the handoff's
   waiting rule and nothing else. */
const { waitingChargeCents } = await import('@/lib/delivery/tariff')

check('5 minutes is included', waitingChargeCents(5) === 0)
check('Exactly 10 minutes is included', waitingChargeCents(10) === 0, String(waitingChargeCents(10)))
check(
  '11 minutes starts the second block and costs 100',
  waitingChargeCents(11) === 100,
  String(waitingChargeCents(11)),
)
check('20 minutes still costs 100', waitingChargeCents(20) === 100, String(waitingChargeCents(20)))
check(
  '21 minutes starts a third block and costs 200',
  waitingChargeCents(21) === 200,
  String(waitingChargeCents(21)),
)
check('45 minutes costs 400', waitingChargeCents(45) === 400, String(waitingChargeCents(45)))

section('10. A tariff nobody can reason about is refused')

const refuses = (label: string, tariff: Tariff) =>
  check(label, (() => {
    try {
      assertTariffSane(tariff)
      return false
    } catch {
      return true
    }
  })())

refuses('Empty band list is refused', { ...MUTARE_PILOT_V1, bands: [] })
refuses('Descending bands are refused', {
  ...MUTARE_PILOT_V1,
  bands: [
    { maxMetres: 5_000, feeCents: 300 },
    { maxMetres: 2_000, feeCents: 200 },
  ],
  maxStandardMetres: 2_000,
})
refuses('A last band that disagrees with the range limit is refused', {
  ...MUTARE_PILOT_V1,
  maxStandardMetres: 20_000,
})
refuses('A fractional fee is refused', {
  ...MUTARE_PILOT_V1,
  bands: [{ maxMetres: 15_000, feeCents: 2.5 }],
  maxStandardMetres: 15_000,
})

section('11. Existing orders keep their own tariff')

/* A tariff change must not reprice history. This proves the pure function
   honours whichever tariff it is handed, which is what makes an immutable
   snapshot on the order meaningful. */
const v2: Tariff = {
  ...MUTARE_PILOT_V1,
  version: 'mutare-pilot-v2-test',
  bands: [
    { maxMetres: 2_000, feeCents: 250 },
    { maxMetres: 5_000, feeCents: 350 },
    { maxMetres: 10_000, feeCents: 450 },
    { maxMetres: 15_000, feeCents: 650 },
  ],
}

check('The same 3 km costs 300 under v1', standardFeeCents(3_000, MUTARE_PILOT_V1) === 300)
check('The same 3 km costs 350 under the test v2', standardFeeCents(3_000, v2) === 350)
check(
  'A priced quote reports the version it used',
  priceQuote({ roadDistanceMetres: 3_000, tariff: v2 }).pricingVersion ===
    'mutare-pilot-v2-test',
)

console.log(
  `\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`,
)
process.exit(failures === 0 ? 0 : 1)
