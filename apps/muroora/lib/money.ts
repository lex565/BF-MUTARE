/**
 * Money.
 *
 * THE ONE RULE: an amount is an integer of the currency's smallest unit, and
 * it is meaningless without the currency beside it. There is no `number`
 * representing dollars anywhere in this codebase.
 *
 * Floats cannot represent money. `0.1 + 0.2 !== 0.3` is not a curiosity, it is
 * a till that does not balance - and this system has to reconcile a shop's
 * stock, a customer's payment and a rider's earnings against each other.
 *
 * WHY CURRENCY IS NOT OPTIONAL HERE
 * Zimbabwe runs USD and ZWL side by side at a rate that moves. An order placed
 * in ZWL today has to still reconcile correctly in six months, which is only
 * true if the rate in force is captured on the order at the moment of sale
 * rather than looked up when someone opens a report. That is why `Money`
 * carries its currency and why orders store `fxRateToUsd`.
 *
 * The master build prompt does not mention currency at all. It should - see
 * D-003 in docs/18_DECISIONS.md.
 */

/** Currencies this system handles. Extend deliberately, not casually. */
export const CURRENCIES = ['USD', 'ZWL'] as const
export type Currency = (typeof CURRENCIES)[number]

/**
 * How many minor units make one major unit.
 * Both of ours are 100. Kept as a table anyway, because a currency with a
 * different exponent (JPY has none, KWD has three) would otherwise silently
 * produce amounts wrong by two orders of magnitude.
 */
const MINOR_UNITS: Record<Currency, number> = {
  USD: 2,
  ZWL: 2,
}

export interface Money {
  /** Integer, in minor units. 1234 with currency USD is $12.34. */
  readonly amount: bigint
  readonly currency: Currency
}

export function money(amount: bigint | number, currency: Currency): Money {
  if (typeof amount === 'number') {
    if (!Number.isInteger(amount)) {
      throw new TypeError(
        `money() received a non-integer (${amount}). Amounts are minor units - ` +
          `pass 1234 for $12.34, or use fromDecimal() if you have a decimal string.`,
      )
    }
    if (!Number.isSafeInteger(amount)) {
      throw new RangeError(`money() received an unsafe integer (${amount}).`)
    }
  }
  return { amount: BigInt(amount), currency }
}

export const zero = (currency: Currency): Money => money(0n, currency)

/** Guards every binary operation. Adding USD to ZWL is a bug, never a total. */
function assertSameCurrency(a: Money, b: Money, op: string): void {
  if (a.currency !== b.currency) {
    throw new TypeError(
      `Cannot ${op} ${a.currency} and ${b.currency}. Convert explicitly, and ` +
        `record the rate you used on the order.`,
    )
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b, 'add')
  return { amount: a.amount + b.amount, currency: a.currency }
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b, 'subtract')
  return { amount: a.amount - b.amount, currency: a.currency }
}

/**
 * Multiply by a whole quantity - a line total, three of something at $4.50.
 * Deliberately integer-only: there is no rounding decision to get wrong.
 */
export function multiply(m: Money, quantity: number): Money {
  if (!Number.isInteger(quantity)) {
    throw new TypeError(
      `multiply() takes a whole quantity, got ${quantity}. For a percentage ` +
        `use percentage(), which states its rounding.`,
    )
  }
  return { amount: m.amount * BigInt(quantity), currency: m.currency }
}

/**
 * A percentage of an amount, rounded half-up.
 *
 * Rounding is stated rather than inherited: `Math.round` rounds -0.5 towards
 * zero, which quietly loses a cent on refunds. Used for discounts and any
 * future commission.
 */
export function percentage(m: Money, percent: number): Money {
  const scaled = m.amount * BigInt(Math.round(percent * 10_000))
  const divisor = 1_000_000n
  const quotient = scaled / divisor
  const remainder = scaled % divisor
  const roundUp = remainder * 2n >= divisor
  const rounded = roundUp ? quotient + 1n : quotient
  return { amount: rounded, currency: m.currency }
}

export const sum = (items: Money[], currency: Currency): Money =>
  items.reduce(add, zero(currency))

export const isZero = (m: Money): boolean => m.amount === 0n
export const isNegative = (m: Money): boolean => m.amount < 0n

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b, 'compare')
  if (a.amount < b.amount) return -1
  if (a.amount > b.amount) return 1
  return 0
}

/**
 * Parse a decimal the way a human typed it - "12.50", "12.5", "12".
 *
 * Done by string, not by `parseFloat(x) * 100`, because that route is exactly
 * where the classic bug lives: 19.99 * 100 is 1998.9999999999998 in IEEE 754,
 * and truncating gives 1998. A cent, silently, on every such price.
 */
export function fromDecimal(input: string, currency: Currency): Money {
  const trimmed = input.trim()
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new TypeError(`fromDecimal() could not parse "${input}".`)
  }

  const exponent = MINOR_UNITS[currency]
  const negative = trimmed.startsWith('-')
  const [whole, fraction = ''] = trimmed.replace('-', '').split('.')

  if (fraction.length > exponent) {
    throw new RangeError(
      `"${input}" has more precision than ${currency} supports ` +
        `(${exponent} decimal places). Round before storing, deliberately.`,
    )
  }

  const padded = fraction.padEnd(exponent, '0')
  const amount = BigInt(whole + padded)
  return { amount: negative ? -amount : amount, currency }
}

/** Minor units back to a plain decimal string. For inputs and CSV, not display. */
export function toDecimal(m: Money): string {
  const exponent = MINOR_UNITS[m.currency]
  const negative = m.amount < 0n
  const digits = (negative ? -m.amount : m.amount).toString().padStart(exponent + 1, '0')
  const whole = digits.slice(0, -exponent) || '0'
  const fraction = digits.slice(-exponent)
  return `${negative ? '-' : ''}${whole}.${fraction}`
}

/** Display. Intl handles the symbol, grouping and placement per locale. */
export function format(m: Money, locale = 'en-ZW'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: m.currency,
    minimumFractionDigits: MINOR_UNITS[m.currency],
  }).format(Number(toDecimal(m)))
}

/**
 * Convert, recording the rate.
 *
 * Returns the rate alongside the result so the caller is pushed to persist it.
 * A converted amount whose rate was not stored cannot be audited later, and
 * this system has to be auditable - see D-003.
 */
export function convert(
  m: Money,
  to: Currency,
  rate: number,
): { result: Money; rate: number; from: Currency } {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new RangeError(`convert() needs a positive finite rate, got ${rate}.`)
  }
  if (m.currency === to) return { result: m, rate: 1, from: m.currency }

  const scaledRate = BigInt(Math.round(rate * 1_000_000))
  const converted = (m.amount * scaledRate + 500_000n) / 1_000_000n
  return { result: { amount: converted, currency: to }, rate, from: m.currency }
}

/** Row shape for persistence. Amount goes to the DB as a string bigint. */
export const toDb = (m: Money) => ({
  amount: m.amount.toString(),
  currency: m.currency,
})

export const fromDb = (row: { amount: string | bigint; currency: string }): Money =>
  money(BigInt(row.amount), row.currency as Currency)
