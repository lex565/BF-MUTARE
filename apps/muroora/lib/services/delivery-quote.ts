import { and, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { businesses } from '@/db/schema/marketplace'
import { deliveryQuotes, deliveryTariffs } from '@/db/schema/delivery'
import { platformSettings } from '@/db/schema/platform'
import {
  MUTARE_PILOT_V1,
  assertTariffSane,
  priceQuote,
  unserviceable,
  type PricedQuote,
  type ServiceabilityReason,
  type Tariff,
} from '@/lib/delivery/tariff'
import {
  MUTARE_SIMULATION_ENVELOPE,
  isInsideArea,
  isValidLatLng,
  routeProvider,
  type LatLng,
  type ServiceArea,
} from '@/lib/delivery/routing'

/**
 * Delivery quotes: the server's answer, and the server's record of it.
 *
 * The handoff's rule is that the server calculates and validates every fee and
 * that a client never computes an authoritative charge. This module is where
 * that authority actually lives. Two functions matter:
 *
 *   quoteDelivery()   decides, prices, and WRITES THE QUOTE DOWN
 *   consumeQuote()    proves at checkout that the quote is ours and still good
 *
 * The writing-down is the part that makes the rest true. A quote a client can
 * describe but the server cannot recognise is not a quote, it is a price the
 * client made up - so `quoteId` is meaningless unless there is a row behind it.
 *
 * Refusals are written down too. "How often did we say no, and why" is what
 * decides whether 15 km is the right limit, and no order will ever record it,
 * because a refusal never becomes an order.
 */

const DEFAULT_TTL_SECONDS = 900

export interface QuoteRequest {
  businessId: string
  destination: LatLng
  isHeavyOrOversized?: boolean
  /** A funded promotion. Capped at the fee by the pricing function. */
  promotionSubsidyCents?: number
}

export interface IssuedQuote extends PricedQuote {
  /** Null only when nothing was persisted, which should not happen. */
  quoteId: string | null
  roadDistanceMetres: number | null
  estimatedTimeSeconds: number | null
  expiresAt: Date | null
  /** True when a person can still ask Musuwo to price this by hand. */
  manualReviewAvailable: boolean
  /** Operator detail. NEVER returned to a customer - see the API route. */
  internalDetail: string | null
}

/* --------------------------------------------------------- configuration */

/**
 * The active tariff, from the database.
 *
 * Falls back to the compiled-in `mutare-pilot-v1` only if the table is empty,
 * which on a migrated database it never is. The fallback exists so a pricing
 * bug can never present as "delivery is free" - the worst case is that the
 * approved tariff is applied.
 *
 * `assertTariffSane` runs on whatever comes back. A tariff edited to something
 * incoherent would otherwise still return a number, and that number would be
 * wrong in a way nobody notices for a month.
 */
export async function loadActiveTariff(): Promise<Tariff> {
  const [row] = await db
    .select()
    .from(deliveryTariffs)
    .where(eq(deliveryTariffs.isActive, true))

  if (!row) return MUTARE_PILOT_V1

  const tariff: Tariff = {
    version: row.version,
    currency: 'USD',
    bands: row.bands,
    maxStandardMetres: row.maxStandardMetres,
    oversizeFeeCents: row.oversizeFeeCents,
    includedWaitingMinutes: row.includedWaitingMinutes,
    waitingBlockMinutes: row.waitingBlockMinutes,
    waitingBlockFeeCents: row.waitingBlockFeeCents,
    returnPercent: row.returnPercent,
  }

  assertTariffSane(tariff)
  return tariff
}

/**
 * The operating area.
 *
 * Ships disabled - see the long note in lib/delivery/routing.ts. While it is
 * disabled `isInsideArea` returns true for everything and range is enforced by
 * the tariff's 15 km limit, which is what was actually approved.
 */
export async function loadServiceArea(): Promise<ServiceArea> {
  const [row] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, 'delivery_service_area'))

  if (!row) return MUTARE_SIMULATION_ENVELOPE

  const value = row.value as Partial<ServiceArea> | null
  if (!value || !Array.isArray(value.rings)) return MUTARE_SIMULATION_ENVELOPE

  return {
    enabled: value.enabled === true,
    name: value.name ?? 'Configured service area',
    rings: value.rings,
  }
}

async function loadTtlSeconds(): Promise<number> {
  const [row] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, 'delivery_quote_ttl_seconds'))

  const raw = Number(row?.value ?? DEFAULT_TTL_SECONDS)
  return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : DEFAULT_TTL_SECONDS
}

/* -------------------------------------------------------------- quoting */

/**
 * Price one delivery, and record the answer.
 *
 * The order of the checks below is the order in section 3 of the handoff, and
 * it is deliberate rather than incidental: everything that can be decided
 * without calling a router is decided first. A merchant who does not deliver,
 * a merchant with no coordinates, and a pin in the sea are all answerable from
 * data already in hand, and calling a paid routing service to discover them
 * would cost money to learn something already known.
 */
export async function quoteDelivery(request: QuoteRequest): Promise<IssuedQuote> {
  const tariff = await loadActiveTariff()

  const [business] = await db
    .select({
      id: businesses.id,
      storeId: businesses.storeId,
      latitude: businesses.latitude,
      longitude: businesses.longitude,
      deliversLocally: businesses.deliversLocally,
    })
    .from(businesses)
    .where(eq(businesses.id, request.businessId))

  if (!business) {
    // Nothing is written: there is no business row to hang a quote off, and
    // delivery_quotes.business_id is NOT NULL for exactly that reason.
    return {
      ...unserviceable('INVALID_LOCATION', tariff),
      quoteId: null,
      roadDistanceMetres: null,
      estimatedTimeSeconds: null,
      expiresAt: null,
      manualReviewAvailable: false,
      internalDetail: `No business ${request.businessId}.`,
    }
  }

  const origin: LatLng | null =
    business.latitude !== null && business.longitude !== null
      ? { latitude: business.latitude, longitude: business.longitude }
      : null

  const record = (
    priced: PricedQuote,
    extra: {
      roadDistanceMetres?: number | null
      estimatedTimeSeconds?: number | null
      routingProvider?: string | null
      routingDataVersion?: string | null
      internalDetail?: string | null
    } = {},
  ) =>
    persist({
      business,
      origin,
      destination: request.destination,
      priced,
      isHeavyOrOversized: request.isHeavyOrOversized === true,
      ...extra,
    })

  /* 1. Is this merchant delivering at all? */
  if (!business.deliversLocally) {
    return record(unserviceable('BUSINESS_NOT_DELIVERING', tariff), {
      internalDetail: 'Merchant is marked collection only.',
    })
  }

  /* 2. Do we know where both ends are? */
  if (!isValidLatLng(origin)) {
    return record(unserviceable('INVALID_LOCATION', tariff), {
      internalDetail:
        'Merchant has no confirmed coordinates. Set businesses.latitude/longitude.',
    })
  }
  if (!isValidLatLng(request.destination)) {
    return record(unserviceable('INVALID_LOCATION', tariff), {
      internalDetail: 'Delivery coordinates are missing or not a real point.',
    })
  }

  /* 3. Is the destination somewhere we operate? */
  const area = await loadServiceArea()
  if (!isInsideArea(request.destination, area)) {
    return record(unserviceable('OUTSIDE_SERVICE_AREA', tariff), {
      internalDetail: `Destination is outside "${area.name}".`,
    })
  }

  /* 4. Is there a road between them? No route is never a straight line. */
  const outcome = await routeProvider().route(origin, request.destination)

  if (!outcome.ok) {
    return record(unserviceable(outcome.reason, tariff), {
      routingProvider: outcome.provider,
      internalDetail: outcome.detail,
    })
  }

  /* 5. Price it. Over the limit comes back as MANUAL_QUOTE_REQUIRED. */
  const priced = priceQuote({
    roadDistanceMetres: outcome.distanceMetres,
    isHeavyOrOversized: request.isHeavyOrOversized,
    promotionSubsidyCents: request.promotionSubsidyCents,
    tariff,
  })

  return record(priced, {
    roadDistanceMetres: outcome.distanceMetres,
    estimatedTimeSeconds: outcome.durationSeconds,
    routingProvider: outcome.provider,
    routingDataVersion: outcome.dataVersion,
  })
}

async function persist(args: {
  business: { id: string; storeId: string | null }
  origin: LatLng | null
  destination: LatLng
  priced: PricedQuote
  isHeavyOrOversized: boolean
  roadDistanceMetres?: number | null
  estimatedTimeSeconds?: number | null
  routingProvider?: string | null
  routingDataVersion?: string | null
  internalDetail?: string | null
}): Promise<IssuedQuote> {
  const ttl = await loadTtlSeconds()
  const expiresAt = new Date(Date.now() + ttl * 1000)

  const [row] = await db
    .insert(deliveryQuotes)
    .values({
      businessId: args.business.id,
      storeId: args.business.storeId,
      pricingVersion: args.priced.pricingVersion,
      serviceable: args.priced.serviceable,
      serviceabilityReason: args.priced.serviceabilityReason,
      originLatitude: args.origin?.latitude ?? null,
      originLongitude: args.origin?.longitude ?? null,
      destinationLatitude: args.destination.latitude,
      destinationLongitude: args.destination.longitude,
      roadDistanceM: args.roadDistanceMetres ?? null,
      estimatedTimeSeconds: args.estimatedTimeSeconds ?? null,
      routingProvider: args.routingProvider ?? null,
      routingDataVersion: args.routingDataVersion ?? null,
      standardFeeCents: args.priced.standardFeeCents,
      oversizeFeeCents: args.priced.oversizeFeeCents,
      promotionSubsidyCents: args.priced.promotionSubsidyCents,
      customerFeeCents: args.priced.customerDeliveryFeeCents,
      isHeavyOrOversized: args.isHeavyOrOversized,
      expiresAt,
    })
    .returning({ id: deliveryQuotes.id, expiresAt: deliveryQuotes.expiresAt })

  return {
    ...args.priced,
    quoteId: row?.id ?? null,
    roadDistanceMetres: args.roadDistanceMetres ?? null,
    estimatedTimeSeconds: args.estimatedTimeSeconds ?? null,
    expiresAt: row?.expiresAt ?? null,
    // Everything we refused can still be priced by a person. That is the
    // difference between "we cannot deliver there" and "go away".
    manualReviewAvailable: !args.priced.serviceable,
    internalDetail: args.internalDetail ?? null,
  }
}

/* ------------------------------------------------------------ redemption */

export class QuoteError extends Error {
  constructor(
    readonly code:
      | 'QUOTE_NOT_FOUND'
      | 'QUOTE_EXPIRED'
      | 'QUOTE_ALREADY_USED'
      | 'QUOTE_NOT_SERVICEABLE'
      | 'QUOTE_WRONG_MERCHANT',
    message: string,
  ) {
    super(message)
    this.name = 'QuoteError'
  }
}

export interface RedeemedQuote {
  quoteId: string
  businessId: string
  pricingVersion: string
  serviceabilityReason: ServiceabilityReason
  roadDistanceM: number
  estimatedTimeSeconds: number | null
  standardFeeCents: number
  oversizeFeeCents: number
  promotionSubsidyCents: number
  customerFeeCents: number
  originLatitude: number | null
  originLongitude: number | null
  destinationLatitude: number | null
  destinationLongitude: number | null
  routingProvider: string | null
  routingDataVersion: string | null
  quotedAt: Date
  expiresAt: Date
}

/**
 * Turn a quote id into the fee the order will actually carry.
 *
 * Everything the client sent about the price is ignored. The handoff says
 * never to trust a posted fee or distance and this is the enforcement: the
 * only thing taken from the client is the id, and every number comes back out
 * of our own row.
 *
 * Expiry is checked against the server clock, not against an `expiresAt` the
 * client echoed back.
 */
export async function redeemQuote(
  quoteId: string,
  expectBusinessId: string,
): Promise<RedeemedQuote> {
  const [row] = await db
    .select()
    .from(deliveryQuotes)
    .where(eq(deliveryQuotes.id, quoteId))

  if (!row) {
    throw new QuoteError(
      'QUOTE_NOT_FOUND',
      'That delivery price is not one we issued. Please get a new quote.',
    )
  }

  if (row.businessId !== expectBusinessId) {
    // A quote for a two-kilometre merchant reused against a fifteen-kilometre
    // one is the obvious way to underpay, so it is checked explicitly.
    throw new QuoteError(
      'QUOTE_WRONG_MERCHANT',
      'That delivery price was quoted for a different shop.',
    )
  }

  if (!row.serviceable || row.customerFeeCents === null || row.roadDistanceM === null) {
    throw new QuoteError(
      'QUOTE_NOT_SERVICEABLE',
      'We could not price a delivery to that location.',
    )
  }

  if (row.consumedAt) {
    throw new QuoteError(
      'QUOTE_ALREADY_USED',
      'That delivery price has already been used on another order.',
    )
  }

  if (row.expiresAt.getTime() <= Date.now()) {
    throw new QuoteError(
      'QUOTE_EXPIRED',
      'That delivery price has expired. Please confirm your location again.',
    )
  }

  return {
    quoteId: row.id,
    businessId: row.businessId,
    pricingVersion: row.pricingVersion,
    serviceabilityReason: row.serviceabilityReason,
    roadDistanceM: row.roadDistanceM,
    estimatedTimeSeconds: row.estimatedTimeSeconds,
    standardFeeCents: row.standardFeeCents ?? 0,
    oversizeFeeCents: row.oversizeFeeCents,
    promotionSubsidyCents: row.promotionSubsidyCents,
    customerFeeCents: row.customerFeeCents,
    originLatitude: row.originLatitude,
    originLongitude: row.originLongitude,
    destinationLatitude: row.destinationLatitude,
    destinationLongitude: row.destinationLongitude,
    routingProvider: row.routingProvider,
    routingDataVersion: row.routingDataVersion,
    quotedAt: row.createdAt,
    expiresAt: row.expiresAt,
  }
}

/**
 * Mark a quote spent, inside the order transaction.
 *
 * The UPDATE carries `consumed_at IS NULL` in its WHERE clause and reports how
 * many rows it changed. That is what makes two simultaneous checkouts safe:
 * both may have read the quote as unused a millisecond apart, but only one
 * UPDATE can match, and the loser's whole transaction rolls back rather than
 * producing a second order at a price that was only ever quoted once.
 */
export async function markQuoteConsumed(
  tx: Pick<typeof db, 'update'>,
  quoteId: string,
  orderId: string,
): Promise<void> {
  const result = await tx
    .update(deliveryQuotes)
    .set({ consumedAt: new Date(), consumedByOrderId: orderId })
    .where(and(eq(deliveryQuotes.id, quoteId), isNull(deliveryQuotes.consumedAt)))
    .returning({ id: deliveryQuotes.id })

  if (result.length === 0) {
    throw new QuoteError(
      'QUOTE_ALREADY_USED',
      'That delivery price was used by another order a moment ago. ' +
        'Nothing has been ordered - please try again.',
    )
  }
}

/** Housekeeping: quotes nobody used. Safe to run any time. */
export async function purgeExpiredQuotes(olderThanDays = 90): Promise<number> {
  const rows = await db
    .delete(deliveryQuotes)
    .where(
      and(
        isNull(deliveryQuotes.consumedAt),
        sql`${deliveryQuotes.expiresAt} < now() - make_interval(days => ${olderThanDays})`,
      ),
    )
    .returning({ id: deliveryQuotes.id })

  return rows.length
}
