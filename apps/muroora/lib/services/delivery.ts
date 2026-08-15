import { and, asc, eq, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { deliveryZones } from '@/db/schema'
import { compare, money, type Money } from '@/lib/money'

/**
 * Delivery zones and fees.
 *
 * The brief: "Do not calculate arbitrary nationwide delivery yet." A fee here
 * is a flat figure attached to a named zone with a list of suburbs, because
 * that is how delivery is actually priced in Mutare — by area, by someone who
 * knows the roads, not by a routing API charging per kilometre of a road that
 * may not be passable.
 *
 * The whole point of this module is that a customer is quoted the same fee the
 * order is charged. Checkout calls `quoteDelivery` and stores what it returns;
 * it never recomputes a fee from a suburb string later.
 */

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID!

export interface DeliveryZone {
  id: string
  name: string
  description: string | null
  suburbs: string[]
  fee: Money
  minimumOrder: Money
  estimatedMinutesMin: number | null
  estimatedMinutesMax: number | null
}

export interface DeliveryQuote {
  zone: DeliveryZone
  fee: Money
  /** Set when the order is below the zone's minimum. Checkout must refuse. */
  belowMinimum: boolean
  shortfall: Money | null
}

export class DeliveryError extends Error {
  constructor(
    readonly code: 'NO_ZONE' | 'BELOW_MINIMUM' | 'NO_ZONES_CONFIGURED',
    message: string,
  ) {
    super(message)
    this.name = 'DeliveryError'
  }
}

/**
 * Normalise a suburb for matching.
 *
 * People type "Dangamvura", "dangamvura", "DANGAMVURA " and "Danga mvura".
 * The first three must all match; the fourth is a different string and is
 * allowed to fail, because guessing at misspellings would silently deliver an
 * order to the wrong side of town.
 */
const normalise = (s: string): string =>
  s.trim().toLowerCase().replace(/\s+/g, ' ')

const toZone = (row: typeof deliveryZones.$inferSelect): DeliveryZone => ({
  id: row.id,
  name: row.name,
  description: row.description,
  suburbs: row.suburbs,
  fee: money(row.baseFeeAmount, row.currency),
  minimumOrder: money(row.minimumOrderAmount, row.currency),
  estimatedMinutesMin: row.estimatedMinutesMin,
  estimatedMinutesMax: row.estimatedMinutesMax,
})

/* ------------------------------------------------------------------ reads */

/**
 * Zones a customer may choose from.
 *
 * Only active ones. A zone switched off is switched off for a reason — the
 * road is out, or nobody covers it this week — and it must disappear from
 * checkout the moment an admin says so.
 */
export async function listActiveZones(): Promise<DeliveryZone[]> {
  const rows = await db
    .select()
    .from(deliveryZones)
    .where(
      and(
        eq(deliveryZones.storeId, STORE_ID),
        eq(deliveryZones.isActive, true),
      ),
    )
    .orderBy(asc(deliveryZones.sortOrder), asc(deliveryZones.name))

  return rows.map(toZone)
}

/** Every zone, including switched-off ones. Admin screens only. */
export async function listAllZones(): Promise<
  (DeliveryZone & { isActive: boolean })[]
> {
  const rows = await db
    .select()
    .from(deliveryZones)
    .where(eq(deliveryZones.storeId, STORE_ID))
    .orderBy(asc(deliveryZones.sortOrder), asc(deliveryZones.name))

  return rows.map((row) => ({ ...toZone(row), isActive: row.isActive }))
}

/**
 * Which zone covers this suburb.
 *
 * Matched in the database, case-insensitively, against the zone's suburb list.
 * Returns null rather than throwing: "we do not deliver there yet" is an
 * ordinary answer at checkout, not an error.
 */
export async function findZoneForSuburb(
  suburb: string,
): Promise<DeliveryZone | null> {
  const wanted = normalise(suburb)
  if (!wanted) return null

  const [row] = await db
    .select()
    .from(deliveryZones)
    .where(
      and(
        eq(deliveryZones.storeId, STORE_ID),
        eq(deliveryZones.isActive, true),
        sql`exists (
          select 1 from unnest(${deliveryZones.suburbs}) AS s
          where lower(btrim(s)) = ${wanted}
        )`,
      ),
    )
    .orderBy(asc(deliveryZones.sortOrder))

  return row ? toZone(row) : null
}

/**
 * The fee for delivering an order of this size to this suburb.
 *
 * Refuses rather than guesses. If no active zone lists the suburb, the answer
 * is "we do not deliver there", not a default fee — a default would quietly
 * commit a rider to a trip nobody priced.
 *
 * The subtotal is passed in because zones carry a minimum order, and the
 * customer should be told they are $3 short at the point they can still add
 * something, not after they have entered their recipient's address.
 */
export async function quoteDelivery(params: {
  suburb: string
  subtotal: Money
}): Promise<DeliveryQuote> {
  const zone = await findZoneForSuburb(params.suburb)

  if (!zone) {
    const configured = await listActiveZones()
    if (configured.length === 0) {
      throw new DeliveryError(
        'NO_ZONES_CONFIGURED',
        'No delivery areas have been set up yet. Nothing can be delivered ' +
          'until an admin adds at least one zone.',
      )
    }
    throw new DeliveryError(
      'NO_ZONE',
      `We do not deliver to ${params.suburb.trim()} yet. We currently cover: ` +
        `${configured.map((z) => z.name).join(', ')}.`,
    )
  }

  if (zone.fee.currency !== params.subtotal.currency) {
    // Not a customer-facing case: it means a zone was configured in ZWL while
    // the shop prices in USD. Loud, because a silent conversion here would be
    // a fee nobody can reconcile.
    throw new DeliveryError(
      'NO_ZONE',
      `Zone ${zone.name} is priced in ${zone.fee.currency} but the order is ` +
        `in ${params.subtotal.currency}. An admin needs to fix the zone.`,
    )
  }

  const belowMinimum = compare(params.subtotal, zone.minimumOrder) < 0

  return {
    zone,
    fee: zone.fee,
    belowMinimum,
    shortfall: belowMinimum
      ? money(zone.minimumOrder.amount - params.subtotal.amount, zone.fee.currency)
      : null,
  }
}
