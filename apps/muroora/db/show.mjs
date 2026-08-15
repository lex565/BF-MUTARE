/** What is actually in the database right now. Read-only. */
import postgres from 'postgres'

const sql = postgres(process.env.DIRECT_URL, { prepare: false, max: 1 })

try {
  const categories = await sql`
    select name, slug, is_active from categories order by sort_order
  `
  const zones = await sql`
    select name, is_active, base_fee_amount, currency from delivery_zones
  `
  const [{ n: products }] = await sql`select count(*)::int as n from products`
  const [{ n: stores }] = await sql`select count(*)::int as n from stores`

  console.log(`\nstores: ${stores}`)

  console.log(`\ncategories (${categories.length}):`)
  for (const c of categories) {
    console.log(`  ${c.is_active ? 'on ' : 'off'}  ${c.name}  /${c.slug}`)
  }

  console.log(`\ndelivery zones (${zones.length}):`)
  for (const z of zones) {
    console.log(
      `  ${z.is_active ? 'on ' : 'OFF'}  ${z.name}  fee=${z.base_fee_amount} ${z.currency} (minor units)`,
    )
  }

  console.log(`\nproducts: ${products}`)
  if (products === 0) {
    console.log('  none, deliberately — the catalogue loads from the real stock list')
  }
  console.log()
} finally {
  await sql.end({ timeout: 5 })
}
