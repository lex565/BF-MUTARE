/**
 * Cart endpoint checks.
 *
 * Exercises the real HTTP API as a guest — no account — because that is the
 * journey the brief insists must work: browse, add to cart, and only meet a
 * login if you want one.
 *
 * The check that matters most is the last one: that the cart refuses to hold
 * more of something than the shop actually has. Everything else is plumbing;
 * that one is the difference between a customer being told "only 3 left" and
 * a customer being told it at the door when their delivery arrives short.
 *
 * Requires the dev server on :3002. Cleans up after itself.
 */
import postgres from 'postgres'

const BASE = 'http://localhost:3002'
const SKU = 'VERIFY-CART'

const sql = postgres(process.env.DIRECT_URL, { prepare: false, max: 1 })
let failures = 0
let cookie = ''

const expect = (label, ok, detail = '') => {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

/** Keeps the guest cart cookie across calls, like a browser would. */
async function api(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...options.headers,
    },
  })
  const setCookie = response.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  const body = await response.json().catch(() => null)
  return { status: response.status, body }
}

try {
  const [store] = await sql`select id from stores limit 1`
  const [category] = await sql`select id from categories limit 1`

  await sql`delete from cart_items where product_id in (select id from products where sku = ${SKU})`
  await sql`delete from inventory where product_id in (select id from products where sku = ${SKU})`
  await sql`delete from products where sku = ${SKU}`

  const [product] = await sql`
    insert into products (store_id, category_id, sku, name, slug, price_amount, is_active)
    values (${store.id}, ${category.id}, ${SKU}, 'Cart check rice', 'cart-check-rice', 250, true)
    returning id
  `
  // Exactly 5 on the shelf. Every stock assertion below hangs off this.
  await sql`
    insert into inventory (store_id, product_id, quantity, reserved)
    values (${store.id}, ${product.id}, 5, 0)
  `
  console.log('\nproduct: "Cart check rice" at $2.50, 5 in stock\n')

  console.log('Guest cart, no account')
  let r = await api('/api/cart')
  expect('empty cart is served', r.status === 200 && r.body.data.itemCount === 0)
  expect('a guest cookie was issued', cookie.startsWith('muroora_cart='))

  console.log('\nAdding')
  r = await api('/api/cart', {
    method: 'POST',
    body: JSON.stringify({ productId: product.id, quantity: 2 }),
  })
  expect('added', r.status === 201)
  expect('two in the cart', r.body.data.itemCount === 2)
  expect('subtotal is $5.00', r.body.data.subtotal.decimal === '5.00')
  expect('subtotal in minor units', r.body.data.subtotal.amount === '500')

  console.log('\nAdding the same thing again increments, not duplicates')
  r = await api('/api/cart', {
    method: 'POST',
    body: JSON.stringify({ productId: product.id, quantity: 1 }),
  })
  expect('one line, not two', r.body.data.lines.length === 1)
  expect('quantity is now 3', r.body.data.lines[0].quantity === 3)
  expect('subtotal is $7.50', r.body.data.subtotal.decimal === '7.50')

  console.log('\nThe cart survives a fresh request')
  r = await api('/api/cart')
  expect('still three', r.body.data.itemCount === 3)

  console.log('\nStock is respected')
  r = await api('/api/cart', {
    method: 'POST',
    body: JSON.stringify({ productId: product.id, quantity: 5 }),
  })
  expect('refuses to exceed stock', r.status === 409)
  expect('says INSUFFICIENT_STOCK', r.body.error?.code === 'INSUFFICIENT_STOCK')
  expect(
    'the message is useful to a shopper',
    /only 5 left/i.test(r.body.error?.message ?? ''),
    r.body.error?.message,
  )

  const after = await api('/api/cart')
  expect('the failed add changed nothing', after.body.data.itemCount === 3)

  console.log('\nSetting an exact quantity')
  r = await api('/api/cart', {
    method: 'PATCH',
    body: JSON.stringify({ productId: product.id, quantity: 5 }),
  })
  expect('five is allowed', r.status === 200 && r.body.data.itemCount === 5)

  r = await api('/api/cart', {
    method: 'PATCH',
    body: JSON.stringify({ productId: product.id, quantity: 6 }),
  })
  expect('six is refused', r.status === 409)

  console.log('\nZero removes the line')
  r = await api('/api/cart', {
    method: 'PATCH',
    body: JSON.stringify({ productId: product.id, quantity: 0 }),
  })
  expect('cart is empty', r.body.data.itemCount === 0)
  expect('no lines left', r.body.data.lines.length === 0)

  console.log('\nBad input')
  r = await api('/api/cart', {
    method: 'POST',
    body: JSON.stringify({ productId: 'not-a-uuid' }),
  })
  expect('rejects a malformed id', r.status === 400)

  r = await api('/api/cart', {
    method: 'POST',
    body: JSON.stringify({ productId: '00000000-0000-0000-0000-000000000000' }),
  })
  expect('rejects an unknown product', r.status === 400 || r.status === 404)

  console.log('\nA withdrawn product cannot be added')
  await api('/api/cart', {
    method: 'POST',
    body: JSON.stringify({ productId: product.id, quantity: 1 }),
  })
  await sql`update products set is_active = false where id = ${product.id}`
  r = await api('/api/cart', {
    method: 'POST',
    body: JSON.stringify({ productId: product.id, quantity: 1 }),
  })
  expect('refused once hidden', r.status === 409)

  const hidden = await api('/api/cart')
  expect(
    'and it drops out of the cart view',
    hidden.body.data.lines.length === 0,
  )
} finally {
  await sql`delete from cart_items where product_id in (select id from products where sku = ${SKU})`
  await sql`delete from inventory where product_id in (select id from products where sku = ${SKU})`
  await sql`delete from products where sku = ${SKU}`
  await sql`delete from carts where token is not null and expires_at > now() and id not in (select cart_id from cart_items)`
  console.log('\ncleaned up')
  await sql.end({ timeout: 5 })
}

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} FAILED.`}\n`)
process.exit(failures > 0 ? 1 : 0)
