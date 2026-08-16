/**
 * The schema, as one module.
 *
 * Drizzle needs every table and relation in a single object to resolve the
 * relational query API, so everything is re-exported here.
 *
 * Phases 3-5 add riders, deliveries, proof of delivery, earnings and payouts.
 * They are deliberately absent rather than stubbed: a table nobody writes to
 * is a table nobody maintains, and rider tables in particular carry the
 * sensitive-document handling described in D-005, which should be built when
 * it is being used, not months earlier.
 */

export * from './_shared'
export * from './identity'
export * from './staff'
export * from './catalogue'
export * from './inventory'
export * from './cart'
export * from './orders'
export * from './delivery'
