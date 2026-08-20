/**
 * Recompute the daily analytics rollups.
 *
 *   npm run analytics:rollup
 *
 * Safe to run at any time and any number of times: every statement is keyed on
 * the natural primary key and sets rather than increments, so a second run
 * produces the same numbers as the first. See lib/services/analytics-rollup.ts.
 */
import { rollUpRecent } from '@/lib/services/analytics-rollup'

const result = await rollUpRecent()
console.log(`product rows ${result.products}, merchant rows ${result.merchants}`)
process.exit(0)
