import { sql } from 'drizzle-orm'
import {
  bigint,
  index,
  jsonb,
  pgEnum,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Column primitives shared by every table.
 *
 * Defined once so the rules from docs/18_DECISIONS.md are enforced by the
 * types rather than by everyone remembering them.
 */

/** Currencies. Mirrors CURRENCIES in lib/money.ts — keep the two in step. */
export const currencyEnum = pgEnum('currency', ['USD', 'ZWL'])

/**
 * A monetary column pair: amount in minor units, plus its currency.
 *
 * `bigint` with `mode: 'string'` so values cross the driver boundary without
 * passing through a JS number. A price of $12.34 is stored as 1234, and it is
 * meaningless without the currency column beside it — see D-003.
 */
export const moneyColumns = (name: string) => ({
  [`${name}Amount`]: bigint(`${name}_amount`, { mode: 'bigint' }).notNull(),
  [`${name}Currency`]: currencyEnum(`${name}_currency`).notNull().default('USD'),
})

/** Primary key. UUID, never a sequential integer exposed to a customer. */
export const id = () => uuid('id').primaryKey().defaultRandom()

/** Timestamps. `withTimezone` always — the shop, a rider and a diaspora buyer
 *  in the UK are not in the same offset, and a naive timestamp will eventually
 *  put an order in the wrong day. */
export const timestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/**
 * Soft delete.
 *
 * Products and riders are referenced by historical orders and earnings. Hard
 * deleting either would tear a hole in records the business has to be able to
 * account for, so rows are retired rather than removed.
 */
export const softDelete = () => ({
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

/**
 * The multi-tenant key.
 *
 * Every domain table carries it, even though there is exactly one store today
 * and the brief puts third-party merchants out of scope for version 1. It is
 * the entire "supports future merchants without a rewrite" requirement and it
 * costs one column now — see D-002. Adding it later means backfilling every
 * row of every table and rewriting every query.
 */
export const storeId = () => uuid('store_id').notNull()

/**
 * Free-form structured detail on ledger and event rows.
 *
 * MUST BE `jsonb`, NOT `text`.
 *
 * This was `text().$type<Record<string, unknown>>()` — which type-checks
 * perfectly and is silently wrong. Drizzle passes the object straight to the
 * driver for a text column, Postgres stringifies it, and every row stored the
 * literal `"[object Object]"`. Every audit entry, order event and stock
 * movement lost its detail; the log still said who did what, and threw away
 * what they actually did.
 *
 * `$type` describes what TypeScript should believe. It does not make the
 * database store it that way. The column type has to agree.
 */
export const metadata = () =>
  jsonb('metadata').$type<Record<string, unknown> | null>()

/** Index helper for the store scope, which nearly every query filters on. */
export const storeIndex = (table: string) => (t: { storeId: unknown }) =>
  index(`${table}_store_idx`).on(t.storeId as never)

/** Postgres `now()` for defaults in raw SQL migrations. */
export const now = sql`now()`
