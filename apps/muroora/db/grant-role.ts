import { and, eq } from 'drizzle-orm'

import { db } from './client'
import { auditLog, userRoles, users } from './schema'

/**
 * Grant a role from the command line.
 *
 *   npm run db:grant -- someone@example.com ADMIN
 *
 * THIS EXISTS BECAUSE OF A DELIBERATE GAP. Public signup can only ever create
 * a CUSTOMER, and roles are granted by an existing admin — which leaves the
 * question of where the FIRST admin comes from. The answer is here: somebody
 * with access to the server and the database credentials, on purpose, once.
 *
 * After that first grant, use the admin screens. This script writes an
 * audit_log row with actor 'cli' every time, so a privilege granted this way
 * is never invisible.
 *
 * The person must already have signed up through the website. This grants a
 * role to an existing account; it does not create logins.
 */

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID
const VALID = [
  'CUSTOMER',
  'SHOP_STAFF',
  'ADMIN',
  'RIDER',
  'SUPER_ADMIN',
] as const

type Role = (typeof VALID)[number]

async function main() {
  const [email, role] = process.argv.slice(2)

  if (!email || !role) {
    console.error('Usage: npm run db:grant -- <email> <ROLE>')
    console.error(`Roles: ${VALID.join(', ')}`)
    process.exit(1)
  }
  if (!VALID.includes(role as Role)) {
    console.error(`"${role}" is not a role. One of: ${VALID.join(', ')}`)
    process.exit(1)
  }
  if (!STORE_ID) {
    console.error('NEXT_PUBLIC_STORE_ID is not set. Run npm run db:seed first.')
    process.exit(1)
  }

  const normalised = email.trim().toLowerCase()
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalised))

  if (!user) {
    console.error(`\nNo account for ${normalised}.`)
    console.error('They need to create one on the website first, at /login.')
    console.error('This grants a role to an existing account; it does not')
    console.error('create logins.')
    process.exit(1)
  }

  const existing = await db
    .select()
    .from(userRoles)
    .where(
      and(
        eq(userRoles.userId, user.id),
        eq(userRoles.role, role as Role),
        eq(userRoles.storeId, STORE_ID),
      ),
    )

  if (existing.length > 0) {
    console.log(`\n${normalised} already has ${role}. Nothing to do.`)
    process.exit(0)
  }

  await db.insert(userRoles).values({
    userId: user.id,
    role: role as Role,
    storeId: STORE_ID,
  })

  // A privilege granted outside the app is exactly the kind of thing that
  // should never be silent.
  await db.insert(auditLog).values({
    storeId: STORE_ID,
    actorId: null,
    actorRole: 'cli',
    action: 'ROLE_GRANTED',
    entityType: 'user',
    entityId: user.id,
    changes: { role, grantedVia: 'db/grant-role.ts', email: normalised },
  })

  console.log(`\nGranted ${role} to ${normalised}.`)
  console.log('Written to the audit log.\n')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\nFailed:', error)
    process.exit(1)
  })
