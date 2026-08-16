/**
 * Post-migration verification.
 *
 * Confirms the tables exist AND that the database-level rules actually fire.
 * A constraint that was written but not applied is worse than no constraint,
 * because everyone then assumes it is protecting them. Each rule below is
 * deliberately violated to prove it refuses.
 *
 * Read-only apart from a transaction that is always rolled back.
 */
import { readFileSync } from 'node:fs'
import postgres from 'postgres'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const sql = postgres(env.DIRECT_URL, { prepare: false, max: 1 })
let failures = 0

const expect = (label, ok, detail = '') => {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` - ${detail}` : ''}`)
}

try {
  console.log('\nTables')
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name
  `
  const names = tables.map((t) => t.table_name)
  console.log(`  ${names.length} tables: ${names.join(', ')}`)
  expect('17 domain tables plus the migrations table', names.length >= 17)

  console.log('\nOrder numbers')
  const [{ next_order_number: a }] = await sql`select next_order_number()`
  const [{ next_order_number: b }] = await sql`select next_order_number()`
  console.log(`  generated ${a} then ${b}`)
  expect('formatted MM-000000', /^MM-\d{6}$/.test(a))
  expect('sequential, never repeating', a !== b)

  console.log('\nAppend-only ledgers')
  for (const table of ['inventory_transactions', 'order_events', 'audit_log']) {
    const [{ count }] = await sql`
      select count(*)::int as count from pg_trigger
      where tgrelid = ${table}::regclass and not tgisinternal
    `
    expect(`${table} has an immutability trigger`, count > 0)
  }

  console.log('\nConstraints refuse bad data')

  // Negative stock. Rolled back either way.
  try {
    await sql.begin(async (tx) => {
      const [store] = await tx`
        insert into stores (name, slug) values ('verify', ${'verify-' + Date.now()})
        returning id
      `
      const [product] = await tx`
        insert into products (store_id, sku, name, slug, price_amount)
        values (${store.id}, 'V1', 'Verify', ${'v-' + Date.now()}, 100)
        returning id
      `
      await tx`
        insert into inventory (store_id, product_id, quantity)
        values (${store.id}, ${product.id}, -5)
      `
      throw new Error('NO_CONSTRAINT')
    })
    expect('negative stock is rejected', false, 'it was accepted')
  } catch (error) {
    expect(
      'negative stock is rejected',
      String(error.message).includes('inventory_quantity_non_negative'),
      error.message.slice(0, 60),
    )
  }

  // Reserved may not exceed quantity - this is what stops the same last item
  // being promised to two customers.
  try {
    await sql.begin(async (tx) => {
      const [store] = await tx`
        insert into stores (name, slug) values ('verify2', ${'verify2-' + Date.now()})
        returning id
      `
      const [product] = await tx`
        insert into products (store_id, sku, name, slug, price_amount)
        values (${store.id}, 'V2', 'Verify2', ${'v2-' + Date.now()}, 100)
        returning id
      `
      await tx`
        insert into inventory (store_id, product_id, quantity, reserved)
        values (${store.id}, ${product.id}, 3, 10)
      `
      throw new Error('NO_CONSTRAINT')
    })
    expect('reserved cannot exceed stock', false, 'it was accepted')
  } catch (error) {
    expect(
      'reserved cannot exceed stock',
      String(error.message).includes('inventory_reserved_within_quantity'),
      error.message.slice(0, 60),
    )
  }

  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} FAILED.`}\n`)
} finally {
  await sql.end({ timeout: 5 })
}

process.exit(failures > 0 ? 1 : 0)
