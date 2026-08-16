/** Honest Phase 1 status straight from the database. Read-only. */
import postgres from 'postgres'

const sql = postgres(process.env.DIRECT_URL, { prepare: false, max: 1 })

try {
  const [users] = await sql`select count(*)::int as n from users`
  const roles = await sql`select role, count(*)::int as n from user_roles group by role`
  const [orders] = await sql`select count(*)::int as n from orders`
  const [products] = await sql`select count(*)::int as n from products`
  const [carts] = await sql`select count(*)::int as n from carts`
  const [zones] = await sql`select count(*)::int as n from delivery_zones where is_active`

  console.log(`  users              ${users.n}`)
  console.log(
    `  roles granted      ${roles.length === 0 ? 'NONE - no admin exists yet' : roles.map((r) => `${r.role}=${r.n}`).join(', ')}`,
  )
  console.log(`  products           ${products.n}`)
  console.log(`  active zones       ${zones.n}`)
  console.log(`  carts              ${carts.n}`)
  console.log(`  orders             ${orders.n}`)
} finally {
  await sql.end({ timeout: 5 })
}
