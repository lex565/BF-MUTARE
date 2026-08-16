import { eq, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { auditLog, deliveryZones, orders } from '@/db/schema'
import { fromDecimal } from '@/lib/money'

/**
 * Delivery zone administration.
 *
 * Kept apart from `lib/services/delivery.ts` for the same reason the product
 * service has separate public and admin reads: the customer-facing module has
 * no write functions at all, so nothing reachable from a shop page can change
 * a fee.
 */

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID!

export class ZoneError extends Error {
  constructor(
    readonly code: 'NOT_FOUND' | 'DUPLICATE_SUBURB' | 'INVALID',
    message: string,
  ) {
    super(message)
    this.name = 'ZoneError'
  }
}

/** Same normalisation the matcher uses, so what you type is what will match. */
const normalise = (s: string): string =>
  s.trim().toLowerCase().replace(/\s+/g, ' ')

const parseSuburbs = (input: string): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of input.split(/[,\n]/)) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const key = normalise(trimmed)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

/**
 * Refuse a suburb that is already in another zone.
 *
 * Two zones claiming Chikanga would mean the fee depends on which row the
 * database happened to return first - the same customer quoted $2 today and
 * $4 tomorrow, with nothing in the data to explain it.
 */
async function assertNoOverlap(
  suburbs: string[],
  exceptZoneId?: string,
): Promise<void> {
  const rows = await db
    .select({
      id: deliveryZones.id,
      name: deliveryZones.name,
      suburbs: deliveryZones.suburbs,
    })
    .from(deliveryZones)
    .where(eq(deliveryZones.storeId, STORE_ID))

  const wanted = new Set(suburbs.map(normalise))

  for (const row of rows) {
    if (row.id === exceptZoneId) continue
    for (const existing of row.suburbs) {
      if (wanted.has(normalise(existing))) {
        throw new ZoneError(
          'DUPLICATE_SUBURB',
          `${existing} is already in the ${row.name} zone. A suburb can only ` +
            `belong to one zone, otherwise the fee depends on luck.`,
        )
      }
    }
  }
}

export async function createZone(
  params: {
    name: string
    description?: string
    /** Comma or newline separated. */
    suburbs: string
    /** Decimal string, e.g. "3.00". Parsed by lib/money, never parseFloat. */
    fee: string
    minimumOrder?: string
    estimatedMinutesMin?: number
    estimatedMinutesMax?: number
  },
  actorId: string,
): Promise<{ id: string }> {
  const name = params.name.trim()
  if (!name) throw new ZoneError('INVALID', 'The zone needs a name.')

  const suburbs = parseSuburbs(params.suburbs)
  if (suburbs.length === 0) {
    throw new ZoneError(
      'INVALID',
      'List at least one suburb, or nothing will ever match this zone.',
    )
  }

  let fee, minimum
  try {
    fee = fromDecimal(params.fee, 'USD')
    minimum = fromDecimal(params.minimumOrder?.trim() || '0', 'USD')
  } catch {
    throw new ZoneError(
      'INVALID',
      'Fees must be an amount like 3.00 - digits and one decimal point.',
    )
  }

  if (fee.amount < 0n || minimum.amount < 0n) {
    throw new ZoneError('INVALID', 'Amounts cannot be negative.')
  }

  await assertNoOverlap(suburbs)

  const [created] = await db
    .insert(deliveryZones)
    .values({
      storeId: STORE_ID,
      name,
      description: params.description?.trim() || null,
      suburbs,
      currency: 'USD',
      baseFeeAmount: fee.amount,
      minimumOrderAmount: minimum.amount,
      estimatedMinutesMin: params.estimatedMinutesMin ?? null,
      estimatedMinutesMax: params.estimatedMinutesMax ?? null,
      isActive: true,
    } as never)
    .returning({ id: deliveryZones.id })

  await db.insert(auditLog).values({
    storeId: STORE_ID,
    actorId,
    actorRole: 'ADMIN',
    action: 'DELIVERY_ZONE_CREATED',
    entityType: 'delivery_zone',
    entityId: created.id,
    changes: { name, suburbs, fee: params.fee, minimum: params.minimumOrder },
  })

  return created
}

export async function updateZone(
  params: {
    id: string
    name?: string
    suburbs?: string
    fee?: string
    minimumOrder?: string
    estimatedMinutesMin?: number
    estimatedMinutesMax?: number
  },
  actorId: string,
): Promise<void> {
  const [zone] = await db
    .select()
    .from(deliveryZones)
    .where(eq(deliveryZones.id, params.id))

  if (!zone) throw new ZoneError('NOT_FOUND', 'No such zone.')

  const patch: Record<string, unknown> = { updatedAt: new Date() }

  if (params.name !== undefined && params.name.trim()) {
    patch.name = params.name.trim()
  }

  if (params.suburbs !== undefined) {
    const suburbs = parseSuburbs(params.suburbs)
    if (suburbs.length === 0) {
      throw new ZoneError('INVALID', 'A zone needs at least one suburb.')
    }
    await assertNoOverlap(suburbs, zone.id)
    patch.suburbs = suburbs
  }

  try {
    if (params.fee !== undefined && params.fee.trim()) {
      patch.baseFeeAmount = fromDecimal(params.fee, 'USD').amount
    }
    if (params.minimumOrder !== undefined) {
      patch.minimumOrderAmount = fromDecimal(
        params.minimumOrder.trim() || '0',
        'USD',
      ).amount
    }
  } catch {
    throw new ZoneError('INVALID', 'Fees must be an amount like 3.00.')
  }

  if (params.estimatedMinutesMin !== undefined) {
    patch.estimatedMinutesMin = params.estimatedMinutesMin
  }
  if (params.estimatedMinutesMax !== undefined) {
    patch.estimatedMinutesMax = params.estimatedMinutesMax
  }

  await db.update(deliveryZones).set(patch).where(eq(deliveryZones.id, zone.id))

  await db.insert(auditLog).values({
    storeId: STORE_ID,
    actorId,
    actorRole: 'ADMIN',
    action: 'DELIVERY_ZONE_UPDATED',
    entityType: 'delivery_zone',
    entityId: zone.id,
    changes: {
      before: {
        name: zone.name,
        fee: zone.baseFeeAmount.toString(),
        suburbs: zone.suburbs,
      },
      after: patch,
    },
  })
}

/**
 * Switch a zone off, or back on.
 *
 * Never deleted. Orders point at `zoneId`, and a deleted zone would leave last
 * month's deliveries unable to say which area they were priced for.
 */
export async function setZoneActive(
  params: { id: string; isActive: boolean },
  actorId: string,
): Promise<{ openOrders: number }> {
  const [zone] = await db
    .select()
    .from(deliveryZones)
    .where(eq(deliveryZones.id, params.id))

  if (!zone) throw new ZoneError('NOT_FOUND', 'No such zone.')

  // Reported back, not blocked. Switching a zone off because a road is out is
  // legitimate even with deliveries pending - but the admin should be told
  // there are people waiting, rather than finding out later.
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      sql`${orders.zoneId} = ${zone.id} AND ${orders.status} NOT IN
          ('DELIVERED', 'CANCELLED', 'REFUNDED')`,
    )

  await db
    .update(deliveryZones)
    .set({ isActive: params.isActive, updatedAt: new Date() })
    .where(eq(deliveryZones.id, zone.id))

  await db.insert(auditLog).values({
    storeId: STORE_ID,
    actorId,
    actorRole: 'ADMIN',
    action: params.isActive ? 'DELIVERY_ZONE_ENABLED' : 'DELIVERY_ZONE_DISABLED',
    entityType: 'delivery_zone',
    entityId: zone.id,
    changes: { name: zone.name, openOrders: n },
  })

  return { openOrders: n }
}
