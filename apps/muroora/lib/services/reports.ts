import { and, eq, gte, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import {
  inventory,
  inventoryTransactions,
  orderItems,
  orders,
  products,
} from '@/db/schema'
import { money, type Money } from '@/lib/money'

/**
 * Numbers for the reports screen.
 *
 * Every figure comes from what actually happened: order rows, order items, the
 * stock ledger. Nothing is projected, smoothed or estimated.
 *
 * WHERE THERE IS NO DATA, THAT IS SAID rather than drawn as a flat line at
 * zero. A chart of zeroes looks like a measurement of a quiet week; an empty
 * state says the shop has not traded yet. Those are different facts and the
 * screen should not confuse them.
 */

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID!

/** Statuses that mean money was actually committed. */
const COMMITTED = [
  'PAYMENT_CONFIRMED',
  'ORDER_RECEIVED',
  'ACCEPTED',
  'PICKING',
  'AWAITING_SUBSTITUTION_APPROVAL',
  'PACKED',
  'READY_FOR_PICKUP',
  'DRIVER_ASSIGNED',
  'RIDER_AT_STORE',
  'COLLECTED',
  'OUT_FOR_DELIVERY',
  'RIDER_ARRIVED',
  'DELIVERED',
]

export interface DayPoint {
  day: string
  label: string
  orders: number
  amount: Money
}

export interface TopProduct {
  name: string
  quantity: number
  revenue: Money
}

export interface StockBand {
  label: string
  count: number
  tone: 'bad' | 'warn' | 'good'
}

export interface Reports {
  days: number
  hasOrders: boolean
  daily: DayPoint[]
  totals: {
    orders: number
    revenue: Money
    averageOrder: Money | null
    delivered: number
    cancelled: number
  }
  topProducts: TopProduct[]
  stockBands: StockBand[]
  stockMoves: { type: string; count: number; net: number }[]
}

export async function getReports(days = 30): Promise<Reports> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const [dailyRows, totalRows, topRows, stockRows, moveRows] =
    await Promise.all([
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${orders.placedAt}), 'YYYY-MM-DD')`,
          n: sql<number>`count(*)::int`,
          amount: sql<string>`coalesce(sum(${orders.totalAmount}), 0)::text`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.storeId, STORE_ID),
            gte(orders.placedAt, since),
            sql`${orders.status}::text = any(${COMMITTED})`,
          ),
        )
        .groupBy(sql`date_trunc('day', ${orders.placedAt})`)
        .orderBy(sql`date_trunc('day', ${orders.placedAt})`),

      db
        .select({
          status: orders.status,
          n: sql<number>`count(*)::int`,
          amount: sql<string>`coalesce(sum(${orders.totalAmount}), 0)::text`,
        })
        .from(orders)
        .where(and(eq(orders.storeId, STORE_ID), gte(orders.placedAt, since)))
        .groupBy(orders.status),

      db
        .select({
          name: orderItems.productName,
          quantity: sql<number>`sum(${orderItems.quantity})::int`,
          revenue: sql<string>`sum(${orderItems.lineTotalAmount})::text`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          and(
            eq(orders.storeId, STORE_ID),
            gte(orders.placedAt, since),
            sql`${orders.status}::text = any(${COMMITTED})`,
          ),
        )
        .groupBy(orderItems.productName)
        .orderBy(sql`sum(${orderItems.quantity}) desc`)
        .limit(8),

      db
        .select({
          out: sql<number>`count(*) filter (where ${inventory.quantity} - ${inventory.reserved} <= 0)::int`,
          low: sql<number>`count(*) filter (where ${inventory.quantity} - ${inventory.reserved} > 0 and ${inventory.quantity} - ${inventory.reserved} <= ${products.lowStockThreshold})::int`,
          fine: sql<number>`count(*) filter (where ${inventory.quantity} - ${inventory.reserved} > ${products.lowStockThreshold})::int`,
        })
        .from(products)
        .leftJoin(inventory, eq(inventory.productId, products.id))
        .where(and(eq(products.storeId, STORE_ID), eq(products.isActive, true))),

      db
        .select({
          type: inventoryTransactions.type,
          count: sql<number>`count(*)::int`,
          net: sql<number>`coalesce(sum(${inventoryTransactions.quantityChange}), 0)::int`,
        })
        .from(inventoryTransactions)
        .where(
          and(
            eq(inventoryTransactions.storeId, STORE_ID),
            gte(inventoryTransactions.createdAt, since),
          ),
        )
        .groupBy(inventoryTransactions.type)
        .orderBy(sql`count(*) desc`),
    ])

  // Fill every day in the window, so a gap reads as a quiet day rather than
  // the chart silently compressing time.
  const byDay = new Map(dailyRows.map((r) => [r.day, r]))
  const daily: DayPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    const row = byDay.get(key)
    daily.push({
      day: key,
      label: new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
      }).format(d),
      orders: row?.n ?? 0,
      amount: money(BigInt(row?.amount ?? '0'), 'USD'),
    })
  }

  const committedTotals = totalRows.filter((r) =>
    COMMITTED.includes(r.status),
  )
  const orderCount = committedTotals.reduce((n, r) => n + r.n, 0)
  const revenue = committedTotals.reduce((t, r) => t + BigInt(r.amount), 0n)

  const stock = stockRows[0] ?? { out: 0, low: 0, fine: 0 }

  return {
    days,
    hasOrders: orderCount > 0,
    daily,
    totals: {
      orders: orderCount,
      revenue: money(revenue, 'USD'),
      averageOrder:
        orderCount > 0 ? money(revenue / BigInt(orderCount), 'USD') : null,
      delivered: totalRows.find((r) => r.status === 'DELIVERED')?.n ?? 0,
      cancelled: totalRows.find((r) => r.status === 'CANCELLED')?.n ?? 0,
    },
    topProducts: topRows.map((r) => ({
      name: r.name,
      quantity: r.quantity,
      revenue: money(BigInt(r.revenue), 'USD'),
    })),
    stockBands: [
      { label: 'Out of stock', count: stock.out, tone: 'bad' },
      { label: 'Running low', count: stock.low, tone: 'warn' },
      { label: 'Well stocked', count: stock.fine, tone: 'good' },
    ],
    stockMoves: moveRows,
  }
}
