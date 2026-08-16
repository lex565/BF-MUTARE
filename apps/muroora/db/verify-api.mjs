/**
 * Prove the public API cannot leak cost price.
 *
 * Inserts a product whose cost price is a value that would be unmistakable if
 * it appeared anywhere, calls the public endpoints, and greps the raw response
 * text for it. Then removes the product again.
 *
 * Worth doing as a real test rather than by reading the code: the leak this
 * guards against is a `select *` added by someone in six months, and only an
 * assertion against the actual response will catch that.
 *
 * Requires the dev server on :3002.
 */
import postgres from 'postgres'

const BASE = 'http://localhost:3002'
const COST_MARKER = '99999' // $999.99 - unmistakable in any payload
const SKU = 'VERIFY-COST-LEAK'

const sql = postgres(process.env.DIRECT_URL, { prepare: false, max: 1 })
let failures = 0

const expect = (label, ok, detail = '') => {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` - ${detail}` : ''}`)
}

try {
  const [store] = await sql`select id from stores limit 1`
  const [category] = await sql`select id from categories limit 1`

  await sql`delete from products where sku = ${SKU}`

  const [product] = await sql`
    insert into products
      (store_id, category_id, sku, name, slug, price_amount, cost_price_amount, is_active)
    values
      (${store.id}, ${category.id}, ${SKU}, 'Leak check product', 'leak-check-product',
       1500, ${COST_MARKER}, true)
    returning id, slug
  `
  await sql`
    insert into inventory (store_id, product_id, quantity)
    values (${store.id}, ${product.id}, 10)
  `
  console.log(`\ninserted a product priced $15.00 with cost $999.99\n`)

  console.log('Public list endpoint')
  const listRaw = await fetch(`${BASE}/api/products`).then((r) => r.text())
  expect('returns the product', listRaw.includes('Leak check product'))
  expect('does NOT contain the cost value', !listRaw.includes(COST_MARKER))
  expect('has no costPrice field', !listRaw.includes('costPrice'))
  expect('reports availability, not a raw count', listRaw.includes('IN_STOCK'))
  expect('does not expose the stock number', !/"quantity"\s*:/.test(listRaw))

  console.log('\nPublic detail endpoint')
  const oneRaw = await fetch(`${BASE}/api/products/${product.slug}`).then((r) =>
    r.text(),
  )
  expect('returns the product', oneRaw.includes('Leak check product'))
  expect('does NOT contain the cost value', !oneRaw.includes(COST_MARKER))
  expect('has no costPrice field', !oneRaw.includes('costPrice'))

  console.log('\nMoney shape')
  const parsed = JSON.parse(oneRaw)
  expect('price is minor units as a string', parsed.data.price.amount === '1500')
  expect('price carries its currency', parsed.data.price.currency === 'USD')
  expect('price has a display decimal', parsed.data.price.decimal === '15.00')

  console.log('\nHidden products are invisible')
  await sql`update products set is_active = false where id = ${product.id}`
  const hiddenList = await fetch(`${BASE}/api/products`).then((r) => r.text())
  const hiddenOne = await fetch(`${BASE}/api/products/${product.slug}`)
  expect('gone from the list', !hiddenList.includes('Leak check product'))
  expect('detail returns 404', hiddenOne.status === 404)
} finally {
  await sql`delete from inventory where product_id in (select id from products where sku = ${SKU})`
  await sql`delete from products where sku = ${SKU}`
  console.log('\ncleaned up the test product')
  await sql.end({ timeout: 5 })
}

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} FAILED.`}\n`)
process.exit(failures > 0 ? 1 : 0)
