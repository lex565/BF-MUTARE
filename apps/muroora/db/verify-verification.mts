/**
 * Prove the Verified badge cannot be faked.
 *
 *   npm run db:verify-badge
 *
 * The badge is a promise Musuwo makes to a customer on a stranger's behalf, so
 * the interesting cases are all the ways it could appear without anybody
 * having checked anything. Each one is attempted and must be refused BY THE
 * DATABASE - not by the form, which is one refactor away from not asking.
 */

import { eq, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { businesses } from '@/db/schema/marketplace'
import { listPublicBusinesses } from '@/lib/services/marketplace'

let failures = 0

function check(name: string, passed: boolean, detail = '') {
  if (!passed) failures += 1
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`)
}

async function refused(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn()
    return false
  } catch {
    return true
  }
}

const SLUG = `check-verify-${Date.now()}`

async function main() {
  // A PILOT business needs a reviewer: an existing CHECK refuses APPROVED,
  // PILOT or ACTIVE without one, which is itself worth knowing about.
  const ownerRows = await db.execute(
    sql`SELECT user_id AS id FROM platform_roles WHERE role = 'PLATFORM_OWNER' LIMIT 1`,
  )
  const ownerId = (ownerRows as unknown as { id: string }[])[0]?.id
  if (!ownerId) throw new Error('No Platform Owner. Run npm run platform:whoami.')

  const [biz] = await db
    .insert(businesses)
    .values({
      name: 'Check Verify Co',
      slug: SLUG,
      kind: 'RETAIL',
      status: 'PILOT',
      city: 'Mutare',
      reviewedBy: ownerId,
      reviewedAt: new Date(),
    })
    .returning({ id: businesses.id })

  console.log('--- a badge with nothing behind it')

  check(
    'verifiedAt alone is refused',
    await refused(() =>
      db.update(businesses).set({ verifiedAt: new Date() }).where(eq(businesses.id, biz.id)),
    ),
  )

  check(
    'verifiedAt + verifiedBy without a licence number is refused',
    await refused(() =>
      db
        .update(businesses)
        .set({ verifiedAt: new Date(), verifiedBy: ownerId })
        .where(eq(businesses.id, biz.id)),
    ),
  )

  console.log('\n--- a complete record is accepted')

  await db
    .update(businesses)
    .set({ licenceNumber: 'CHK-0001', verifiedAt: new Date(), verifiedBy: ownerId })
    .where(eq(businesses.id, biz.id))

  const [after] = await db
    .select({ verifiedAt: businesses.verifiedAt, licence: businesses.licenceNumber })
    .from(businesses)
    .where(eq(businesses.id, biz.id))

  check('licence + checker + date together is accepted', after.verifiedAt !== null)

  console.log('\n--- what reaches the public')

  const publicRows = await listPublicBusinesses()
  const mine = publicRows.find((b) => b.slug === SLUG)

  check('the business is listed publicly', Boolean(mine))
  check('it carries the verified flag', mine?.verified === true)
  check(
    'the licence NUMBER is never in the public payload',
    mine !== undefined && !Object.keys(mine).includes('licenceNumber'),
  )
  check(
    'nor is the document path',
    mine !== undefined && !JSON.stringify(mine).includes('licence'),
  )

  console.log('\n--- withdrawing clears everything')

  await db
    .update(businesses)
    .set({ licenceNumber: null, licenceDocumentPath: null, verifiedAt: null, verifiedBy: null })
    .where(eq(businesses.id, biz.id))

  const [cleared] = await db
    .select({ verifiedAt: businesses.verifiedAt, licence: businesses.licenceNumber })
    .from(businesses)
    .where(eq(businesses.id, biz.id))

  check('no stale licence number is left behind', cleared.licence === null)
  check('and the badge is gone', cleared.verifiedAt === null)

  await db.delete(businesses).where(eq(businesses.id, biz.id))

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
  process.exitCode = failures === 0 ? 0 : 1
}

await main()
process.exit(process.exitCode ?? 0)
