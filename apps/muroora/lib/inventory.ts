import { and, eq, sql } from 'drizzle-orm'

import { db, type DbOrTx } from '@/db/client'
import { inventory, inventoryTransactions } from '@/db/schema'

/**
 * Stock movements.
 *
 * THIS IS THE ONLY MODULE ALLOWED TO WRITE TO `inventory` OR
 * `inventory_transactions`. Nothing else — no route handler, no server action,
 * no component — touches either table directly.
 *
 * The reason is the invariant: the balance and the ledger row that explains it
 * must be written in the same database transaction, or the ledger stops being
 * able to account for the balance. Scattering `update inventory set quantity`
 * across the codebase is how a shop ends up with a number nobody can explain.
 *
 * Every function here takes an optional transaction so callers can compose —
 * order creation reserves stock inside the same transaction that writes the
 * order, so a failure halfway leaves neither.
 */

export type StockMoveType =
  | 'RESTOCK'
  | 'SALE'
  | 'RETURN'
  | 'DAMAGED'
  | 'LOST'
  | 'MANUAL_ADJUSTMENT'
  | 'CANCELLED_ORDER_RESTOCK'
  | 'RESERVATION'
  | 'RESERVATION_RELEASED'

export interface StockMove {
  storeId: string
  productId: string
  type: StockMoveType
  /** Signed. Negative removes stock. */
  quantityChange: number
  reason?: string
  referenceType?: string
  referenceId?: string
  performedBy?: string
  metadata?: Record<string, unknown>
}

export class InsufficientStockError extends Error {
  constructor(
    readonly productId: string,
    readonly requested: number,
    readonly available: number,
  ) {
    super(
      `Insufficient stock for product ${productId}: asked for ${requested}, ` +
        `${available} sellable.`,
    )
    this.name = 'InsufficientStockError'
  }
}

/** Types that must carry a reason. An unexplained adjustment is a hole. */
const REASON_REQUIRED: ReadonlySet<StockMoveType> = new Set([
  'MANUAL_ADJUSTMENT',
  'DAMAGED',
  'LOST',
])

/**
 * Apply a movement: lock the row, write the ledger, update the balance.
 *
 * `FOR UPDATE` on the select is load-bearing. Two customers buying the last
 * bag of rice at the same instant would otherwise both read quantity 1, both
 * pass the check and both succeed, leaving -1. The lock makes the second wait
 * for the first to commit, so it reads the real remaining figure.
 */
export async function applyStockMove(
  move: StockMove,
  tx?: DbOrTx,
): Promise<{ quantityBefore: number; quantityAfter: number }> {
  const run = async (conn: DbOrTx) => {
    if (REASON_REQUIRED.has(move.type) && !move.reason?.trim()) {
      throw new Error(
        `A ${move.type} needs a reason. Somebody has to be able to read this ` +
          `ledger in six months and understand what happened.`,
      )
    }

    const [row] = await conn
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.storeId, move.storeId),
          eq(inventory.productId, move.productId),
        ),
      )
      .for('update')

    if (!row) {
      throw new Error(
        `No inventory row for product ${move.productId}. Create one when the ` +
          `product is created, so stock is explicitly zero rather than absent.`,
      )
    }

    const before = row.quantity
    const after = before + move.quantityChange
    const allowNegative = row.allowNegative === 'true'

    if (after < 0 && !allowNegative) {
      throw new InsufficientStockError(
        move.productId,
        Math.abs(move.quantityChange),
        before - row.reserved,
      )
    }

    // Ledger first, then balance — both inside one transaction, so a crash
    // between them rolls back rather than leaving a balance nothing explains.
    await conn.insert(inventoryTransactions).values({
      storeId: move.storeId,
      productId: move.productId,
      type: move.type,
      quantityChange: move.quantityChange,
      quantityBefore: before,
      quantityAfter: after,
      referenceType: move.referenceType ?? null,
      referenceId: move.referenceId ?? null,
      reason: move.reason ?? null,
      performedBy: move.performedBy ?? null,
      metadata: move.metadata ?? null,
    })

    await conn
      .update(inventory)
      .set({ quantity: after, updatedAt: new Date() })
      .where(eq(inventory.id, row.id))

    return { quantityBefore: before, quantityAfter: after }
  }

  return tx ? run(tx) : db.transaction(run)
}

/**
 * Hold stock for an order that is placed but not yet packed.
 *
 * Reserving does not change `quantity` — the goods are still on the shelf.
 * It raises `reserved`, and sellable is quantity minus reserved. The brief
 * asks for stock to be reserved at checkout; this is that, and it is what
 * stops the shop selling the same last item twice.
 */
export async function reserveStock(
  params: {
    storeId: string
    productId: string
    quantity: number
    orderId: string
    performedBy?: string
  },
  tx?: DbOrTx,
): Promise<void> {
  const run = async (conn: DbOrTx) => {
    const [row] = await conn
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.storeId, params.storeId),
          eq(inventory.productId, params.productId),
        ),
      )
      .for('update')

    if (!row) {
      throw new Error(`No inventory row for product ${params.productId}.`)
    }

    const sellable = row.quantity - row.reserved
    if (params.quantity > sellable && row.allowNegative !== 'true') {
      throw new InsufficientStockError(
        params.productId,
        params.quantity,
        sellable,
      )
    }

    await conn
      .update(inventory)
      .set({
        reserved: row.reserved + params.quantity,
        updatedAt: new Date(),
      })
      .where(eq(inventory.id, row.id))

    // Logged so a reservation is visible in the history even though the
    // balance did not move. Otherwise "why can't I sell this?" is unanswerable.
    await conn.insert(inventoryTransactions).values({
      storeId: params.storeId,
      productId: params.productId,
      type: 'RESERVATION',
      quantityChange: 0,
      quantityBefore: row.quantity,
      quantityAfter: row.quantity,
      referenceType: 'order',
      referenceId: params.orderId,
      reason: `Reserved ${params.quantity} for order`,
      performedBy: params.performedBy ?? null,
      metadata: { reserved: params.quantity },
    })
  }

  return tx ? run(tx) : db.transaction(run)
}

/** Release a hold — cancelled order, or the goods have now actually left. */
export async function releaseReservation(
  params: {
    storeId: string
    productId: string
    quantity: number
    orderId: string
    /** True when the goods left the shop: also deducts the balance. */
    fulfilled: boolean
    performedBy?: string
  },
  tx?: DbOrTx,
): Promise<void> {
  const run = async (conn: DbOrTx) => {
    const [row] = await conn
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.storeId, params.storeId),
          eq(inventory.productId, params.productId),
        ),
      )
      .for('update')

    if (!row) return

    // Never below zero: a double-release would otherwise make everything
    // look sellable and quietly oversell the shelf.
    const nextReserved = Math.max(0, row.reserved - params.quantity)

    await conn
      .update(inventory)
      .set({ reserved: nextReserved, updatedAt: new Date() })
      .where(eq(inventory.id, row.id))

    if (params.fulfilled) {
      await applyStockMove(
        {
          storeId: params.storeId,
          productId: params.productId,
          type: 'SALE',
          quantityChange: -params.quantity,
          referenceType: 'order',
          referenceId: params.orderId,
          performedBy: params.performedBy,
        },
        conn,
      )
    } else {
      await conn.insert(inventoryTransactions).values({
        storeId: params.storeId,
        productId: params.productId,
        type: 'RESERVATION_RELEASED',
        quantityChange: 0,
        quantityBefore: row.quantity,
        quantityAfter: row.quantity,
        referenceType: 'order',
        referenceId: params.orderId,
        reason: 'Reservation released without sale',
        performedBy: params.performedBy ?? null,
      })
    }
  }

  return tx ? run(tx) : db.transaction(run)
}

/** What a customer can actually buy right now. */
export async function sellableQuantity(
  storeId: string,
  productId: string,
): Promise<number> {
  const [row] = await db
    .select({
      sellable: sql<number>`${inventory.quantity} - ${inventory.reserved}`,
    })
    .from(inventory)
    .where(
      and(eq(inventory.storeId, storeId), eq(inventory.productId, productId)),
    )

  return row?.sellable ?? 0
}

/**
 * Verify the ledger explains the balance.
 *
 * Sums every movement for a product and compares it to the stored quantity.
 * They must match exactly; if they do not, something wrote to `inventory`
 * without going through this module. Worth running as a scheduled check —
 * silent drift is the failure mode that costs a shop real money.
 */
export async function reconcile(
  storeId: string,
  productId: string,
): Promise<{ balance: number; ledgerSum: number; drift: number }> {
  const [balanceRow] = await db
    .select({ quantity: inventory.quantity })
    .from(inventory)
    .where(
      and(eq(inventory.storeId, storeId), eq(inventory.productId, productId)),
    )

  const [ledgerRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${inventoryTransactions.quantityChange}), 0)`,
    })
    .from(inventoryTransactions)
    .where(
      and(
        eq(inventoryTransactions.storeId, storeId),
        eq(inventoryTransactions.productId, productId),
      ),
    )

  const balance = balanceRow?.quantity ?? 0
  const ledgerSum = Number(ledgerRow?.total ?? 0)
  return { balance, ledgerSum, drift: balance - ledgerSum }
}
