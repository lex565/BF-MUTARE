import { and, desc, eq, gte, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import {
  auditLog,
  inventory,
  inventoryTransactions,
  orders,
  products,
  staffProfiles,
  users,
} from '@/db/schema'
import { money, type Money } from '@/lib/money'

/**
 * The staff welcome screen.
 *
 * The owner's requirement: "a welcome message when they log in give them a
 * brief overview of what has been added and what workers are there what time
 * they logged in and other statistics".
 *
 * Everything here is read from what actually happened - the audit log, the
 * stock ledger, the order events. Nothing is estimated and nothing is
 * invented; where there is no data yet, the screen says so rather than
 * showing a zero that looks like a real measurement.
 */

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID!

const DAYS = 7

export interface RecentChange {
  what: string
  detail: string
  who: string | null
  at: Date
}

export interface Colleague {
  name: string
  staffNumber: string
  jobTitle: string | null
  roles: string[]
  photoPath: string | null
  isYou: boolean
}

export interface StaffDashboard {
  /** When this session began, from Supabase. Null if it cannot be read. */
  signedInAt: Date | null
  team: Colleague[]
  recent: RecentChange[]
  stock: {
    products: number
    lowOrOut: number
    addedThisWeek: number
    movementsThisWeek: number
  }
  orders: {
    waiting: number
    beingPacked: number
    onTheWay: number
    deliveredThisWeek: number
    takenThisWeek: Money | null
  }
}

/** Turn an audit action into something a person would say. */
function describe(action: string, changes: Record<string, unknown> | null) {
  const c = changes ?? {}
  switch (action) {
    case 'PRODUCT_CREATED':
      return { what: 'New product', detail: String(c.name ?? 'a product') }
    case 'PRODUCT_UPDATED':
      return { what: 'Product changed', detail: String(c.name ?? 'a product') }
    case 'STOCK_ADJUSTED':
      return {
        what: 'Stock adjusted',
        detail: `${c.name ?? 'a product'}${c.change ? ` (${c.change})` : ''}`,
      }
    case 'STAFF_PROMOTED':
      return {
        what: 'Access granted',
        detail: `${c.email ?? 'someone'} → ${c.role ?? 'a role'}`,
      }
    case 'ROLE_REVOKED':
      return { what: 'Access removed', detail: String(c.role ?? '') }
    case 'STAFF_STATUS_CHANGED':
      return { what: 'Staff status', detail: `${c.from} → ${c.to}` }
    case 'STAFF_PHOTO_SET':
      return { what: 'Photo added', detail: String(c.staffNumber ?? '') }
    case 'DELIVERY_ZONE_CREATED':
      return { what: 'Delivery area added', detail: String(c.name ?? '') }
    case 'DELIVERY_ZONE_UPDATED':
      return { what: 'Delivery area changed', detail: '' }
    case 'DELIVERY_ZONE_ENABLED':
      return { what: 'Delivering again', detail: String(c.name ?? '') }
    case 'DELIVERY_ZONE_DISABLED':
      return { what: 'Stopped delivering', detail: String(c.name ?? '') }
    default:
      return { what: action.toLowerCase().replace(/_/g, ' '), detail: '' }
  }
}

export async function getStaffDashboard(
  viewerId: string,
  signedInAt: Date | null,
): Promise<StaffDashboard> {
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000)

  const [teamRows, auditRows, productRows, orderRows] = await Promise.all([
    db
      .select({
        userId: staffProfiles.userId,
        staffNumber: staffProfiles.staffNumber,
        jobTitle: staffProfiles.jobTitle,
        photoPath: staffProfiles.photoPath,
        fullName: users.fullName,
        email: users.email,
      })
      .from(staffProfiles)
      .innerJoin(users, eq(staffProfiles.userId, users.id))
      .where(
        and(
          eq(staffProfiles.storeId, STORE_ID),
          eq(staffProfiles.status, 'ACTIVE'),
        ),
      )
      .orderBy(staffProfiles.staffNumber),

    db
      .select({
        action: auditLog.action,
        changes: auditLog.changes,
        createdAt: auditLog.createdAt,
        actorName: users.fullName,
      })
      .from(auditLog)
      .leftJoin(users, eq(auditLog.actorId, users.id))
      .where(
        and(eq(auditLog.storeId, STORE_ID), gte(auditLog.createdAt, since)),
      )
      .orderBy(desc(auditLog.createdAt))
      .limit(12),

    db
      .select({
        total: sql<number>`count(*)::int`,
        lowOrOut: sql<number>`count(*) filter (
          where ${inventory.quantity} - ${inventory.reserved}
                <= ${products.lowStockThreshold}
        )::int`,
        addedThisWeek: sql<number>`count(*) filter (
          where ${products.createdAt} >= ${since.toISOString()}
        )::int`,
      })
      .from(products)
      .leftJoin(inventory, eq(inventory.productId, products.id))
      .where(
        and(eq(products.storeId, STORE_ID), eq(products.isActive, true)),
      ),

    db
      .select({
        status: orders.status,
        n: sql<number>`count(*)::int`,
        total: sql<string>`coalesce(sum(${orders.totalAmount}), 0)::text`,
        placedAt: sql<string>`max(${orders.placedAt})::text`,
      })
      .from(orders)
      .where(eq(orders.storeId, STORE_ID))
      .groupBy(orders.status),
  ])

  const [{ movementsThisWeek }] = await db
    .select({ movementsThisWeek: sql<number>`count(*)::int` })
    .from(inventoryTransactions)
    .where(
      and(
        eq(inventoryTransactions.storeId, STORE_ID),
        gte(inventoryTransactions.createdAt, since),
      ),
    )

  const roles = await db
    .select({ userId: sql<string>`user_id`, role: sql<string>`role` })
    .from(sql`user_roles`)
    .where(sql`store_id = ${STORE_ID}`)

  const rolesByUser = new Map<string, string[]>()
  for (const r of roles) {
    if (r.role === 'CUSTOMER') continue
    rolesByUser.set(r.userId, [...(rolesByUser.get(r.userId) ?? []), r.role])
  }

  const countIn = (statuses: string[]) =>
    orderRows
      .filter((r) => statuses.includes(r.status))
      .reduce((n, r) => n + r.n, 0)

  const deliveredRows = orderRows.filter((r) => r.status === 'DELIVERED')
  const takenAmount = deliveredRows.reduce(
    (t, r) => t + BigInt(r.total),
    0n,
  )

  return {
    signedInAt,
    team: teamRows.map((t) => ({
      name: t.fullName ?? t.email ?? 'Unnamed',
      staffNumber: t.staffNumber,
      jobTitle: t.jobTitle,
      roles: rolesByUser.get(t.userId) ?? [],
      photoPath: t.photoPath,
      isYou: t.userId === viewerId,
    })),
    recent: auditRows.map((a) => ({
      ...describe(a.action, a.changes),
      who: a.actorName,
      at: a.createdAt,
    })),
    stock: {
      products: productRows[0]?.total ?? 0,
      lowOrOut: productRows[0]?.lowOrOut ?? 0,
      addedThisWeek: productRows[0]?.addedThisWeek ?? 0,
      movementsThisWeek,
    },
    orders: {
      waiting: countIn(['PENDING_PAYMENT', 'PAYMENT_CONFIRMED', 'ORDER_RECEIVED']),
      beingPacked: countIn([
        'ACCEPTED',
        'PICKING',
        'AWAITING_SUBSTITUTION_APPROVAL',
        'PACKED',
        'READY_FOR_PICKUP',
      ]),
      onTheWay: countIn([
        'DRIVER_ASSIGNED',
        'RIDER_AT_STORE',
        'COLLECTED',
        'OUT_FOR_DELIVERY',
        'RIDER_ARRIVED',
      ]),
      deliveredThisWeek: countIn(['DELIVERED']),
      // Null, not zero, when nothing has been delivered. A zero here would
      // read as "we took nothing this week" rather than "nothing has happened
      // yet", and those are different facts.
      takenThisWeek:
        deliveredRows.length > 0 ? money(takenAmount, 'USD') : null,
    },
  }
}
