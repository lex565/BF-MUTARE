/**
 * Cross-business isolation, proved by trying to break it.
 *
 * Creates two throwaway businesses with one member each, then has each member
 * attempt everything they must not be able to do to the other. Every attempt
 * has to be refused. Everything created here is removed at the end, including
 * after a failure.
 *
 * WHY THIS EXISTS RATHER THAN A COMMENT SAYING "isolated".
 *
 * Row level security does not provide this isolation. The application connects
 * as the table owner and bypasses RLS by design, so the boundary is entirely
 * in `lib/services/marketplace.ts`. A boundary that lives in application code
 * is a boundary that a future refactor can quietly remove, and the only thing
 * that notices is a test that actually attempts the crossing.
 *
 * Run with:  npx tsx db/verify-marketplace.mts
 */
import { eq, inArray } from 'drizzle-orm'

import { db } from '@/db/client'
import {
  businessApplications,
  businessMemberships,
  businesses,
} from '@/db/schema/marketplace'
import { products, stores } from '@/db/schema/catalogue'
import { users } from '@/db/schema/identity'
import {
  MarketplaceError,
  listMarketplaceProducts,
  listPublicBusinesses,
  myBusinesses,
  requireMembership,
  setProductPublication,
} from '@/lib/services/marketplace'

let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.log(`  FAIL  ${name}${detail ? ' - ' + detail : ''}`)
  }
}

/** Assert that a call is refused, and refused for the stated reason. */
async function refuses(name: string, code: string, fn: () => Promise<unknown>) {
  try {
    await fn()
    check(name, false, 'it was ALLOWED')
  } catch (error) {
    const actual = error instanceof MarketplaceError ? error.code : 'OTHER'
    check(name, actual === code, `refused with ${actual}, expected ${code}`)
  }
}

/**
 * A fresh suffix each run.
 *
 * Stores and businesses have unique slugs, and a run that dies partway leaves
 * rows behind that cannot always be removed (an account which has written to
 * the append-only audit log cannot be deleted at all). A fixed slug therefore
 * makes the second run fail on a unique constraint for reasons that have
 * nothing to do with what is being tested.
 */
const RUN = Date.now().toString(36)
const TAG = `zz-isolation-check-${RUN}`
const created: { users: string[]; businesses: string[]; stores: string[]; products: string[] } = {
  users: [], businesses: [], stores: [], products: [],
}

async function main() {
  console.log('\nCross-business isolation\n')

  /* ---- two businesses, one member each, each with its own catalogue ---- */

  const [alice] = await db.insert(users).values({
    email: `alice@${TAG}.local`, fullName: 'Isolation check A',
  }).returning({ id: users.id })
  const [bob] = await db.insert(users).values({
    email: `bob@${TAG}.local`, fullName: 'Isolation check B',
  }).returning({ id: users.id })
  created.users.push(alice.id, bob.id)

  const [storeA] = await db.insert(stores).values({
    name: 'Check A', slug: `${TAG}-a`,
  }).returning({ id: stores.id })
  const [storeB] = await db.insert(stores).values({
    name: 'Check B', slug: `${TAG}-b`,
  }).returning({ id: stores.id })
  created.stores.push(storeA.id, storeB.id)

  const [bizA] = await db.insert(businesses).values({
    publicId: `${TAG}-A`, storeId: storeA.id, name: 'Check A', slug: `${TAG}-a`,
    status: 'ACTIVE', reviewedBy: alice.id, reviewedAt: new Date(),
  }).returning({ id: businesses.id })
  const [bizB] = await db.insert(businesses).values({
    publicId: `${TAG}-B`, storeId: storeB.id, name: 'Check B', slug: `${TAG}-b`,
    status: 'ACTIVE', reviewedBy: bob.id, reviewedAt: new Date(),
  }).returning({ id: businesses.id })
  created.businesses.push(bizA.id, bizB.id)

  await db.insert(businessMemberships).values([
    { businessId: bizA.id, userId: alice.id, role: 'BUSINESS_OWNER' },
    { businessId: bizB.id, userId: bob.id, role: 'BUSINESS_OWNER' },
  ])

  const [prodB] = await db.insert(products).values({
    storeId: storeB.id, sku: `${TAG}-sku`, name: 'B private stock',
    slug: `${TAG}-p`, priceAmount: 500n, isActive: true,
  }).returning({ id: products.id })
  created.products.push(prodB.id)

  /* ------------------------------- the attempts that must all be refused */

  const aliceSees = await myBusinesses(alice.id)
  check('A sees only its own business',
    aliceSees.length === 1 && aliceSees[0].businessId === bizA.id,
    `saw ${aliceSees.length}`)

  await refuses("A cannot resolve B's business", 'NOT_A_MEMBER',
    () => requireMembership(alice.id, bizB.id))

  await refuses("A cannot publish B's product by naming B's business", 'NOT_A_MEMBER',
    () => setProductPublication({
      userId: alice.id, businessId: bizB.id, productId: prodB.id, publish: true,
    }))

  // The dangerous one: a real membership, but somebody else's product id.
  // This is what a forged request looks like when the attacker IS a merchant.
  await refuses("A cannot publish B's product through A's own business", 'NOT_FOUND',
    () => setProductPublication({
      userId: alice.id, businessId: bizA.id, productId: prodB.id, publish: true,
    }))

  const [stillPrivate] = await db
    .select({ published: products.publishToMusuwo })
    .from(products).where(eq(products.id, prodB.id))
  check("B's product is still unpublished after every attempt",
    stillPrivate.published === false)

  /* ------------------------------------------- read-only cannot write */

  await db.insert(businessMemberships).values({
    businessId: bizA.id, userId: bob.id, role: 'BUSINESS_VIEWER',
  })
  await refuses('an oversight member cannot publish', 'READ_ONLY',
    () => setProductPublication({
      userId: bob.id, businessId: bizA.id, productId: prodB.id, publish: true,
    }))

  /* ------------------------------------------------ public visibility */

  const publicBiz = await listPublicBusinesses()
  check('public directory never exposes contact details',
    publicBiz.every((b) => !('contactPhone' in b) && !('contactEmail' in b)))

  await db.update(businesses).set({ status: 'SUSPENDED' }).where(eq(businesses.id, bizB.id))
  const afterSuspend = await listPublicBusinesses()
  check('a suspended business disappears from the directory',
    !afterSuspend.some((b) => b.slug === `${TAG}-b`))

  // Publish B's product legitimately, then suspend B again, and confirm the
  // product leaves the marketplace without the catalogue being touched.
  await db.update(businesses).set({ status: 'ACTIVE' }).where(eq(businesses.id, bizB.id))
  await setProductPublication({
    userId: bob.id, businessId: bizB.id, productId: prodB.id, publish: true,
  })
  const listedWhenActive = await listMarketplaceProducts()
  check('a consented product appears while its business is active',
    listedWhenActive.some((p) => p.id === prodB.id))

  await db.update(businesses).set({ status: 'SUSPENDED' }).where(eq(businesses.id, bizB.id))
  const listedWhenSuspended = await listMarketplaceProducts()
  check('suspending a business withdraws its products from the marketplace',
    !listedWhenSuspended.some((p) => p.id === prodB.id))

  const [survives] = await db
    .select({ active: products.isActive }).from(products).where(eq(products.id, prodB.id))
  check("suspension does not touch the merchant's own catalogue",
    survives.active === true)

  check('the marketplace never returns a cost price',
    listedWhenActive.every((p) => !JSON.stringify(p).includes('cost')))
}

/**
 * Teardown.
 *
 * THE TEST ACCOUNTS ARE SOFT-DELETED, NOT REMOVED, and that is deliberate.
 *
 * Publishing a product writes an audit entry naming who did it, and the audit
 * log is append-only: a database trigger refuses UPDATE and DELETE outright
 * ("correct a mistake by inserting a compensating row, not by editing
 * history"). `audit_log.actor_id` then references `users`, so a test account
 * that has ever acted can never be hard-deleted.
 *
 * That is the audit trail working exactly as designed, so the test bends
 * rather than the database. This also matches how the existing verification
 * scripts leave their accounts: soft-deleted and renamed.
 *
 * Each step is independent, because a failure in one must not strand the rest.
 */
async function cleanup() {
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['applications', () => db.delete(businessApplications)
      .where(inArray(businessApplications.applicantId, created.users))],
    ['memberships', () => db.delete(businessMemberships)
      .where(inArray(businessMemberships.businessId, created.businesses))],
    ['products', () => db.delete(products).where(inArray(products.id, created.products))],
    ['businesses', () => db.delete(businesses).where(inArray(businesses.id, created.businesses))],
    ['stores', () => db.delete(stores).where(inArray(stores.id, created.stores))],
    ['users (soft)', () => db.update(users)
      .set({ deletedAt: new Date(), fullName: 'removed test account', email: null })
      .where(inArray(users.id, created.users))],
  ]

  for (const [name, run] of steps) {
    if (!created.users.length) break
    try {
      await run()
    } catch (error) {
      console.log(`  note: could not clean ${name} - ${(error as Error).message.split('\n')[0]}`)
    }
  }
}

try {
  await main()
} catch (error) {
  failed++
  console.error('\n  ERROR', error)
} finally {
  await cleanup()
  const leftovers = created.businesses.length
    ? await db.select({ id: businesses.id }).from(businesses)
        .where(inArray(businesses.id, created.businesses))
    : []
  console.log(`\n  cleaned up, ${leftovers.length} test businesses remain`)
  console.log(`\n${passed} passed, ${failed} failed\n`)
  process.exit(failed === 0 ? 0 : 1)
}
