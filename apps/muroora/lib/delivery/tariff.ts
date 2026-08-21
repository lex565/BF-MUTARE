/**
 * The Mutare delivery tariff, as arithmetic and nothing else.
 *
 * Source of truth for the numbers: MUSUWO_DELIVERY_PRICING_IMPLEMENTATION_HANDOFF.md,
 * pricing version `mutare-pilot-v1`, approved for pilot implementation.
 *
 * Nothing in this file touches the database, the network, the request or the
 * clock. That is deliberate: a fee is the one thing in the system a customer
 * argues about six weeks later, and the answer to "why was I charged $4"
 * should be readable by somebody who does not know Next.js. Every rule below
 * can be checked by hand against the handoff's table.
 *
 * THE UNIT IS METRES, AND IT IS AN INTEGER.
 *
 * The handoff states the bands in kilometres to three decimals, and the
 * required tests turn on exact boundaries: 2.000 km costs 200 cents, 2.001 km
 * costs 300. In binary floating point `2.001 * 1000` is 2000.9999999999998, so
 * a kilometre-based implementation that truncates puts 2.001 km in the wrong
 * band and undercharges every delivery that lands on a boundary. Routing
 * engines report metres as integers anyway, so metres are the honest input and
 * `kmToMetres` below rounds rather than truncates for the callers that only
 * have kilometres.
 *
 * See also lib/money.ts: no float ever represents money here either.
 */

/** The version stamped on every quote and frozen onto every order. */
export const PRICING_VERSION = 'mutare-pilot-v1'

/**
 * Why the reasons are a closed list.
 *
 * The handoff calls these "stable reason codes" and they are: they go into the
 * database on the order, into admin screens, and into analytics. Changing a
 * spelling later silently splits a year of history in two, so they are typed
 * and the database has a matching enum.
 */
export type ServiceabilityReason =
  | 'WITHIN_RANGE'
  | 'TOO_FAR'
  | 'NO_NETWORK_ROUTE'
  | 'INVALID_LOCATION'
  | 'BUSINESS_NOT_DELIVERING'
  | 'OUTSIDE_SERVICE_AREA'
  | 'MANUAL_QUOTE_REQUIRED'

/**
 * A tariff band: everything up to `maxMetres` costs `feeCents`.
 *
 * Bands are inclusive of their upper bound and must be listed in ascending
 * order. `assertTariffSane` enforces both, because a mis-ordered band list
 * produces a plausible-looking fee rather than an error.
 */
export interface TariffBand {
  readonly maxMetres: number
  readonly feeCents: number
}

export interface Tariff {
  readonly version: string
  readonly currency: 'USD'
  readonly bands: readonly TariffBand[]
  /** Beyond the last band there is no standard price, only a manual quote. */
  readonly maxStandardMetres: number
  readonly oversizeFeeCents: number
  /** Waiting time included before the meter starts. */
  readonly includedWaitingMinutes: number
  readonly waitingBlockMinutes: number
  readonly waitingBlockFeeCents: number
  /** Return to merchant, as a percentage of the original standard fee. */
  readonly returnPercent: number
}

/**
 * `mutare-pilot-v1`.
 *
 * This object is the fallback and the shape; the active tariff is read from
 * the `delivery_tariffs` table so a rate can change without a deploy. The
 * handoff is explicit that the constants must not be scattered through React,
 * and equally explicit that changing a tariff creates a NEW VERSION rather
 * than editing one - orders keep the snapshot they were priced under.
 */
export const MUTARE_PILOT_V1: Tariff = {
  version: PRICING_VERSION,
  currency: 'USD',
  bands: [
    { maxMetres: 2_000, feeCents: 200 },
    { maxMetres: 5_000, feeCents: 300 },
    { maxMetres: 10_000, feeCents: 400 },
    { maxMetres: 15_000, feeCents: 600 },
  ],
  maxStandardMetres: 15_000,
  oversizeFeeCents: 200,
  includedWaitingMinutes: 10,
  waitingBlockMinutes: 10,
  waitingBlockFeeCents: 100,
  returnPercent: 75,
}

/**
 * Refuse a tariff that cannot be reasoned about.
 *
 * Called wherever a tariff arrives from outside this file - which, once the
 * table exists, is every real request. A band list that is empty, out of
 * order, or whose last band disagrees with `maxStandardMetres` would still
 * return a number from `standardFeeCents`, and that number would be wrong in a
 * way nobody notices until a month of deliveries has been mispriced.
 */
export function assertTariffSane(tariff: Tariff): void {
  if (tariff.bands.length === 0) {
    throw new Error(`Tariff ${tariff.version} has no bands.`)
  }

  let previous = 0
  for (const band of tariff.bands) {
    if (!Number.isInteger(band.maxMetres) || band.maxMetres <= previous) {
      throw new Error(
        `Tariff ${tariff.version} bands must be ascending integers of metres; ` +
          `saw ${band.maxMetres} after ${previous}.`,
      )
    }
    if (!Number.isInteger(band.feeCents) || band.feeCents < 0) {
      throw new Error(
        `Tariff ${tariff.version} band ending ${band.maxMetres}m has fee ` +
          `${band.feeCents}, which is not a whole number of cents.`,
      )
    }
    previous = band.maxMetres
  }

  const last = tariff.bands[tariff.bands.length - 1]
  if (last.maxMetres !== tariff.maxStandardMetres) {
    throw new Error(
      `Tariff ${tariff.version} says standard delivery reaches ` +
        `${tariff.maxStandardMetres}m but its last band ends at ` +
        `${last.maxMetres}m. One of the two is wrong.`,
    )
  }
}

/**
 * Kilometres to metres, rounded.
 *
 * For callers holding a decimal distance. Rounds because truncation is exactly
 * the boundary bug described at the top of this file.
 */
export const kmToMetres = (km: number): number => Math.round(km * 1000)

/** Metres to kilometres for display, to one decimal. Never used for pricing. */
export const metresToKmDisplay = (metres: number): number =>
  Math.round(metres / 100) / 10

/**
 * The standard fee for a road distance, or null when there is no standard
 * price for it.
 *
 * Null means "over the limit, a human must quote this" - a distinct answer
 * from "zero", and the caller must not coerce one into the other.
 */
export function standardFeeCents(
  metres: number,
  tariff: Tariff = MUTARE_PILOT_V1,
): number | null {
  if (!Number.isFinite(metres)) {
    throw new TypeError(`Road distance must be a number of metres, got ${metres}.`)
  }
  if (!Number.isInteger(metres)) {
    throw new TypeError(
      `Road distance must be a whole number of metres, got ${metres}. ` +
        `Use kmToMetres() if you have kilometres - see the note in this file ` +
        `about 2.001 km.`,
    )
  }
  // Zero is not free delivery, it is a bad route. The handoff requires road
  // distance strictly greater than zero for standard delivery.
  if (metres <= 0) return null
  if (metres > tariff.maxStandardMetres) return null

  for (const band of tariff.bands) {
    if (metres <= band.maxMetres) return band.feeCents
  }

  /* Unreachable while assertTariffSane holds: the last band ends exactly at
     maxStandardMetres, and anything beyond it returned null above. */
  return null
}

export interface QuoteInput {
  /** Road-network distance. Never straight-line - see the handoff, section 3. */
  readonly roadDistanceMetres: number
  readonly isHeavyOrOversized?: boolean
  /**
   * A funded promotion or merchant subsidy, in cents.
   *
   * The handoff forbids free delivery unless something funds it, so this is
   * the only route to a lower fee, and it is capped so it can never make the
   * customer fee negative - a negative fee is a refund the system never agreed
   * to pay.
   */
  readonly promotionSubsidyCents?: number
  readonly tariff?: Tariff
}

export interface PricedQuote {
  readonly pricingVersion: string
  readonly serviceable: boolean
  readonly serviceabilityReason: ServiceabilityReason
  readonly standardFeeCents: number | null
  readonly oversizeFeeCents: number
  readonly promotionSubsidyCents: number
  readonly customerDeliveryFeeCents: number | null
  readonly currency: 'USD'
}

/**
 * Price one delivery.
 *
 * Distance in, fee out. Serviceability questions this function cannot answer -
 * is the merchant delivering at all, is the pin inside the operating area, did
 * the router find a route - are decided by the caller and passed in as a
 * distance or not passed at all. This keeps the arithmetic honest: there is no
 * branch in here that could invent a distance.
 */
export function priceQuote(input: QuoteInput): PricedQuote {
  const tariff = input.tariff ?? MUTARE_PILOT_V1
  assertTariffSane(tariff)

  const standard = standardFeeCents(input.roadDistanceMetres, tariff)

  if (standard === null) {
    const reason: ServiceabilityReason =
      input.roadDistanceMetres > tariff.maxStandardMetres
        ? 'MANUAL_QUOTE_REQUIRED'
        : 'INVALID_LOCATION'

    return {
      pricingVersion: tariff.version,
      serviceable: false,
      serviceabilityReason: reason,
      standardFeeCents: null,
      oversizeFeeCents: 0,
      promotionSubsidyCents: 0,
      customerDeliveryFeeCents: null,
      currency: tariff.currency,
    }
  }

  const oversize = input.isHeavyOrOversized ? tariff.oversizeFeeCents : 0
  const gross = standard + oversize

  const requestedSubsidy = Math.max(0, Math.trunc(input.promotionSubsidyCents ?? 0))
  // Capped at the fee itself. A subsidy larger than the delivery is either a
  // configuration mistake or someone trying to turn delivery into a credit.
  const subsidy = Math.min(requestedSubsidy, gross)

  return {
    pricingVersion: tariff.version,
    serviceable: true,
    serviceabilityReason: 'WITHIN_RANGE',
    standardFeeCents: standard,
    oversizeFeeCents: oversize,
    promotionSubsidyCents: subsidy,
    customerDeliveryFeeCents: gross - subsidy,
    currency: tariff.currency,
  }
}

/** An unserviceable answer, shaped like a priced one so callers branch once. */
export function unserviceable(
  reason: ServiceabilityReason,
  tariff: Tariff = MUTARE_PILOT_V1,
): PricedQuote {
  return {
    pricingVersion: tariff.version,
    serviceable: false,
    serviceabilityReason: reason,
    standardFeeCents: null,
    oversizeFeeCents: 0,
    promotionSubsidyCents: 0,
    customerDeliveryFeeCents: null,
    currency: tariff.currency,
  }
}

/* ------------------------------------------------ charges after checkout */

/**
 * Waiting time.
 *
 * The first ten minutes are included. After that every STARTED block of ten
 * costs a dollar, which is why this ceils: a driver who waited eleven minutes
 * has begun the second block and the block is charged whole. Eleven minutes
 * costs the same as twenty, and twenty-one costs two dollars.
 */
export function waitingChargeCents(
  waitedMinutes: number,
  tariff: Tariff = MUTARE_PILOT_V1,
): number {
  if (!Number.isFinite(waitedMinutes) || waitedMinutes < 0) {
    throw new TypeError(`Waiting minutes must be zero or more, got ${waitedMinutes}.`)
  }
  const chargeable = waitedMinutes - tariff.includedWaitingMinutes
  if (chargeable <= 0) return 0
  return Math.ceil(chargeable / tariff.waitingBlockMinutes) * tariff.waitingBlockFeeCents
}

/**
 * Returning an undelivered order to the merchant.
 *
 * 75% of the ORIGINAL STANDARD fee - not of the final customer fee, which may
 * have been reduced by a subsidy somebody else funded, and not of the oversize
 * surcharge, which was for carrying it out rather than bringing it back.
 *
 * Rounds half up, as the handoff specifies. `Math.round` already rounds half
 * up for positive numbers; it is written out here so nobody has to remember
 * that it rounds half DOWN for negatives, which is why the input is guarded.
 */
export function returnChargeCents(
  originalStandardFeeCents: number,
  tariff: Tariff = MUTARE_PILOT_V1,
): number {
  if (!Number.isInteger(originalStandardFeeCents) || originalStandardFeeCents < 0) {
    throw new TypeError(
      `Original standard fee must be a whole number of cents, zero or more; ` +
        `got ${originalStandardFeeCents}.`,
    )
  }
  return Math.round((originalStandardFeeCents * tariff.returnPercent) / 100)
}

/**
 * A second attempt the customer caused.
 *
 * The full standard fee again, because it is a second trip. A second attempt
 * caused by Musuwo is not this function and must not be charged at all.
 */
export function redeliveryChargeCents(originalStandardFeeCents: number): number {
  if (!Number.isInteger(originalStandardFeeCents) || originalStandardFeeCents < 0) {
    throw new TypeError(
      `Original standard fee must be a whole number of cents, zero or more; ` +
        `got ${originalStandardFeeCents}.`,
    )
  }
  return originalStandardFeeCents
}
