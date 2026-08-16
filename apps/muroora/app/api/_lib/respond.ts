import { NextResponse } from 'next/server'

import { toDecimal, type Money } from '@/lib/money'

/**
 * Shared response shape for every endpoint.
 *
 * One envelope, so a client - Codex's front end, a future native app - writes
 * its error handling once instead of per endpoint:
 *
 *   success:  { "data": ... }
 *   failure:  { "error": { "code": "...", "message": "..." } }
 *
 * `code` is for the machine and is stable. `message` is for a human and may be
 * reworded. Clients should branch on `code`, never on the message text.
 */

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INSUFFICIENT_STOCK'
  | 'SERVER_ERROR'

const STATUS: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INSUFFICIENT_STOCK: 409,
  SERVER_ERROR: 500,
}

export const ok = <T>(data: T, init?: ResponseInit) =>
  NextResponse.json({ data }, init)

export const fail = (
  code: ApiErrorCode,
  message: string,
  details?: unknown,
) =>
  NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status: STATUS[code] },
  )

/**
 * Money over the wire.
 *
 * Sends all three of amount, currency and a formatted decimal string.
 *
 * `amount` is the integer minor unit and is the ONLY value a client should do
 * arithmetic on. `decimal` is a convenience for display. JSON has no integer
 * type distinct from float, so a client that adds up `decimal` values in
 * JavaScript reintroduces exactly the floating-point bug lib/money.ts exists
 * to prevent - hence sending both, and saying so here.
 */
export const serialiseMoney = (m: Money) => ({
  amount: m.amount.toString(),
  currency: m.currency,
  decimal: toDecimal(m),
})
