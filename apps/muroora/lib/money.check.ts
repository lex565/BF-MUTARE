/**
 * Money layer checks. Run with tsx.
 *
 * Not a substitute for a real test suite (Phase 1 should add one) â€” this is to
 * verify the arithmetic before anything is built on top of it, because a
 * rounding bug here would be silently wrong in every order total.
 */
import {
  add,
  compare,
  convert,
  format,
  fromDecimal,
  money,
  multiply,
  percentage,
  subtract,
  sum,
  toDecimal,
  zero,
} from './money'

let passed = 0
let failed = 0

function check(label: string, actual: unknown, expected: unknown) {
  const ok = String(actual) === String(expected)
  if (ok) {
    passed += 1
    console.log(`  PASS  ${label}`)
  } else {
    failed += 1
    console.log(`  FAIL  ${label}\n        expected ${expected}\n        got      ${actual}`)
  }
}

function throws(label: string, fn: () => unknown) {
  try {
    fn()
    failed += 1
    console.log(`  FAIL  ${label} â€” expected a throw, got none`)
  } catch {
    passed += 1
    console.log(`  PASS  ${label}`)
  }
}

console.log('\nParsing')
check('12.50 -> 1250', fromDecimal('12.50', 'USD').amount, 1250n)
check('12.5  -> 1250', fromDecimal('12.5', 'USD').amount, 1250n)
check('12    -> 1200', fromDecimal('12', 'USD').amount, 1200n)
check('0.01  ->    1', fromDecimal('0.01', 'USD').amount, 1n)
check('-5.25 -> -525', fromDecimal('-5.25', 'USD').amount, -525n)

// The classic float bug this layer exists to prevent:
//   19.99 * 100 = 1998.9999999999998 in IEEE 754, truncating to 1998.
check('19.99 -> 1999, not 1998', fromDecimal('19.99', 'USD').amount, 1999n)
console.log(`        (for reference, 19.99 * 100 = ${19.99 * 100})`)

console.log('\nRound-trip')
check('1250 -> "12.50"', toDecimal(money(1250n, 'USD')), '12.50')
check('   1 -> "0.01"', toDecimal(money(1n, 'USD')), '0.01')
check('   0 -> "0.00"', toDecimal(zero('USD')), '0.00')

console.log('\nArithmetic')
check('10.00 + 2.50', toDecimal(add(fromDecimal('10.00', 'USD'), fromDecimal('2.50', 'USD'))), '12.50')
check('10.00 - 2.50', toDecimal(subtract(fromDecimal('10.00', 'USD'), fromDecimal('2.50', 'USD'))), '7.50')
check('4.50 x 3', toDecimal(multiply(fromDecimal('4.50', 'USD'), 3)), '13.50')
check('sum of three', toDecimal(sum([fromDecimal('1.11', 'USD'), fromDecimal('2.22', 'USD'), fromDecimal('3.33', 'USD')], 'USD')), '6.66')

// 0.1 + 0.2 !== 0.3 in floats. Here it must be exact.
check('0.10 + 0.20 = 0.30 exactly', toDecimal(add(fromDecimal('0.10', 'USD'), fromDecimal('0.20', 'USD'))), '0.30')

console.log('\nPercentage, half-up')
check('10% of 10.00', toDecimal(percentage(fromDecimal('10.00', 'USD'), 10)), '1.00')
check('15% of 33.33', toDecimal(percentage(fromDecimal('33.33', 'USD'), 15)), '5.00')
check('50% of 0.01 rounds up', toDecimal(percentage(fromDecimal('0.01', 'USD'), 50)), '0.01')

console.log('\nGuards')
throws('adding USD to ZWL throws', () => add(money(100n, 'USD'), money(100n, 'ZWL')))
throws('non-integer minor units throws', () => money(12.5 as never, 'USD'))
throws('too much precision throws', () => fromDecimal('1.999', 'USD'))
throws('unparseable throws', () => fromDecimal('twelve', 'USD'))
throws('multiply by a fraction throws', () => multiply(money(100n, 'USD'), 1.5))
throws('convert with rate 0 throws', () => convert(money(100n, 'USD'), 'ZWL', 0))

console.log('\nComparison')
check('10 vs 20', compare(fromDecimal('10.00', 'USD'), fromDecimal('20.00', 'USD')), -1)
check('20 vs 10', compare(fromDecimal('20.00', 'USD'), fromDecimal('10.00', 'USD')), 1)
check('10 vs 10', compare(fromDecimal('10.00', 'USD'), fromDecimal('10.00', 'USD')), 0)

console.log('\nConversion records its rate')
const converted = convert(fromDecimal('10.00', 'USD'), 'ZWL', 36.5)
check('10 USD at 36.5 -> 365.00 ZWL', toDecimal(converted.result), '365.00')
check('rate is returned for persisting', converted.rate, 36.5)

console.log('\nFormatting')
console.log(`  USD: ${format(fromDecimal('1234.50', 'USD'))}`)
console.log(`  ZWL: ${format(fromDecimal('1234.50', 'ZWL'))}`)

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)

