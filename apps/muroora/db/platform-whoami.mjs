/**
 * Who runs Musuwo, right now, according to the database.
 *
 *   npm run platform:whoami
 *
 * Exists because migration 0010 grants the Platform Owner by matching an email
 * address, and an address that does not match inserts nothing without failing
 * the migration. That is the right behaviour - a deploy should not break
 * because a seed row is missing - but it means "did the owner actually get
 * created" is a question somebody has to be able to ask plainly.
 *
 * Read only. It writes nothing and changes nothing.
 */

import postgres from 'postgres'

const sql = postgres(process.env.DIRECT_URL, { max: 1, prepare: false })

try {
  const roles = await sql`
    SELECT pr.role, pr.status, pr.granted_at, u.email, u.full_name,
           (SELECT count(*)::int FROM platform_permissions pp
             WHERE pp.platform_role_id = pr.id) AS permission_count
    FROM platform_roles pr
    JOIN users u ON u.id = pr.user_id
    ORDER BY pr.role, pr.granted_at
  `

  const owner = roles.filter((r) => r.role === 'PLATFORM_OWNER' && r.status === 'ACTIVE')
  const admins = roles.filter((r) => r.role === 'SUPER_ADMIN')
  const activeAdmins = admins.filter((r) => r.status === 'ACTIVE')

  const [cap] = await sql`
    SELECT value FROM platform_settings WHERE key = 'max_active_super_admins'
  `

  console.log('PLATFORM OWNER')
  if (owner.length === 0) {
    console.log('  NOBODY. Migration 0010 matched no account by email.')
    console.log('  Nobody can open the Control Center until this is fixed.')
  } else {
    for (const o of owner) {
      console.log(`  ${o.full_name ?? '(no name)'} <${o.email}>`)
      console.log(`  granted ${o.granted_at.toISOString().slice(0, 10)}`)
    }
  }

  console.log(`\nSUPER ADMINS  ${activeAdmins.length} active of ${cap?.value ?? '?'}`)
  if (admins.length === 0) {
    console.log('  None yet. Only the Platform Owner can add them.')
  } else {
    for (const a of admins) {
      console.log(
        `  ${(a.full_name ?? '(no name)').padEnd(24)} ${String(a.status).padEnd(12)} ${a.permission_count} permission(s)  <${a.email}>`,
      )
    }
  }

  const [audit] = await sql`SELECT count(*)::int AS n FROM platform_audit_log`
  console.log(`\nPlatform audit events: ${audit.n}`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await sql.end()
}
