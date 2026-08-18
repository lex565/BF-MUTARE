/**
 * Remove anything left behind by a verification script that failed part way.
 *
 *   npm run db:clear-checks
 *
 * The verify scripts clean up after themselves when they finish. When one
 * fails mid-run - which is the whole point of having them - it stops before
 * the cleanup and leaves rows behind. This finds them and removes them.
 *
 * SAFE BY CONSTRUCTION: it only ever matches the marker addresses the check
 * scripts use (`@appcheck.local`, `@platformcheck.local`, `@svccheck.local`,
 * `@accesscheck.local`) and slugs beginning `check-`. No real account can hold
 * one: `.local` is not a routable domain, and registration now refuses any
 * address whose domain publishes no mail server.
 *
 * TWO THINGS MAKE THIS FIDDLIER THAN IT LOOKS, and both are correct behaviour
 * rather than obstacles to route around:
 *
 *   The link between a business and its application is circular - each points
 *   at the other - so both are broken before anything is deleted.
 *
 *   `audit_log` has an append-only trigger. An account that once acted as an
 *   admin therefore cannot be deleted without destroying a record that is
 *   supposed to be indestructible. Those accounts are SOFT-deleted instead,
 *   which is what the application does with any retired account, and the audit
 *   entry keeps pointing at a name. Everything else goes completely.
 */

import postgres from 'postgres'

const sql = postgres(process.env.DIRECT_URL, { max: 1, prepare: false })

const MARKS = [
  '%@appcheck.local',
  '%@platformcheck.local',
  '%@svccheck.local',
  '%@accesscheck.local',
]

try {
  const marked = await sql`
    SELECT id, email FROM users WHERE email LIKE ANY(${MARKS})
  `
  const testBusinesses = await sql`
    SELECT id, public_id, name FROM businesses WHERE slug LIKE 'check-%'
  `

  console.log(`Marked accounts:  ${marked.length}`)
  console.log(`Test businesses:  ${testBusinesses.length}`)
  for (const b of testBusinesses) {
    console.log(`   ${b.public_id}  ${b.name}`)
  }

  const ids = marked.map((m) => m.id)
  const bizIds = testBusinesses.map((b) => b.id)

  if (ids.length === 0 && bizIds.length === 0) {
    console.log('\nNothing to clear.')
  } else {
    await sql.begin(async (tx) => {
      // Break the circular references first.
      if (ids.length) {
        await tx`UPDATE business_applications SET business_id = NULL
                 WHERE applicant_id = ANY(${ids})`
      }
      if (bizIds.length) {
        await tx`UPDATE businesses SET application_id = NULL
                 WHERE id = ANY(${bizIds})`
        await tx`DELETE FROM business_memberships WHERE business_id = ANY(${bizIds})`
      }

      if (ids.length) {
        await tx`DELETE FROM business_memberships WHERE user_id = ANY(${ids})`
        await tx`DELETE FROM business_applications WHERE applicant_id = ANY(${ids})`
        await tx`DELETE FROM platform_permissions WHERE platform_role_id IN (
                   SELECT id FROM platform_roles WHERE user_id = ANY(${ids}))`
        await tx`DELETE FROM platform_roles WHERE user_id = ANY(${ids})`
        await tx`DELETE FROM user_roles WHERE user_id = ANY(${ids})`
      }

      if (bizIds.length) {
        await tx`DELETE FROM businesses WHERE id = ANY(${bizIds})`
      }

      if (ids.length) {
        // Only the accounts nothing indestructible points at.
        await tx`DELETE FROM users u WHERE u.id = ANY(${ids})
                 AND NOT EXISTS (SELECT 1 FROM audit_log a WHERE a.actor_id = u.id)
                 AND NOT EXISTS (SELECT 1 FROM platform_audit_log p WHERE p.actor_id = u.id)`
        // The rest are retired rather than erased.
        await tx`UPDATE users SET deleted_at = now()
                 WHERE id = ANY(${ids}) AND deleted_at IS NULL`
      }
    })

    console.log('\nCleared.')
  }

  const [{ count: stillActive }] = await sql`
    SELECT count(*)::int AS count FROM users
    WHERE email LIKE ANY(${MARKS}) AND deleted_at IS NULL
  `
  const [{ count: stillSoft }] = await sql`
    SELECT count(*)::int AS count FROM users
    WHERE email LIKE ANY(${MARKS}) AND deleted_at IS NOT NULL
  `
  const [{ count: realBusinesses }] = await sql`
    SELECT count(*)::int AS count FROM businesses WHERE deleted_at IS NULL
  `
  const [{ count: realApplications }] = await sql`
    SELECT count(*)::int AS count FROM business_applications
  `

  console.log(`\nCheck accounts still active:      ${stillActive}`)
  console.log(`Check accounts retired (kept for audit): ${stillSoft}`)
  console.log(`Real businesses:                  ${realBusinesses}`)
  console.log(`Real applications:                ${realApplications}`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await sql.end()
}
