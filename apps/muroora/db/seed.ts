import { eq } from 'drizzle-orm'

import { db } from './client'
import { categories, deliveryZones, stores } from './schema'

/**
 * Seed.
 *
 * WHAT THIS DOES AND DOES NOT CREATE
 *
 * It creates the store row, the six real product categories from Muroora
 * Mart's own company profile, and two example delivery zones.
 *
 * It does NOT create products.
 *
 * That is deliberate. This is an operating shop, and invented products with
 * invented prices would be indistinguishable from real ones once they were in
 * the database — and a customer would eventually try to order one. The
 * catalogue gets loaded from the shop's actual stock list, by an admin, once
 * that list exists. An empty catalogue that says so is honest; a full one of
 * fictional groceries is not.
 *
 * Idempotent: safe to run repeatedly. Nothing is overwritten.
 */

const STORE_SLUG = 'muroora-mart'

/**
 * From Muroora_Mart_Company_Profile.pdf, section 03 "Products & Services".
 * These are the client's own six groupings, not a generic supermarket taxonomy.
 */
const CATEGORIES = [
  {
    slug: 'basic-groceries',
    name: 'Basic groceries',
    description: 'Maize meal, cooking oil, sugar, salt, rice, flour and legumes.',
  },
  {
    slug: 'packaged-food-drink',
    name: 'Packaged food & drink',
    description: 'Canned goods, juices, soft drinks and snack items.',
  },
  {
    slug: 'cleaning-supplies',
    name: 'Cleaning supplies',
    description: 'Detergents, disinfectants and surface cleaners.',
  },
  {
    slug: 'personal-hygiene',
    name: 'Personal hygiene',
    description: 'Soaps, shampoos, toothpaste and sanitary items.',
  },
  {
    slug: 'kitchen-supplies',
    name: 'Kitchen supplies',
    description: 'Cookware, utensils and storage containers.',
  },
  {
    slug: 'daily-use',
    name: 'Daily-use items',
    description: 'Batteries, candles, light bulbs and miscellaneous consumables.',
  },
]

/**
 * Example zones only.
 *
 * The brief: "Do not hard-code the examples into production." The suburbs are
 * real Mutare ones so the shape is testable, but the fees are placeholders and
 * the rows are marked inactive — an admin sets the real ones. Nothing here
 * quotes a customer a delivery price the business has not agreed to.
 */
const ZONES = [
  {
    name: 'Zone A — Central',
    description: 'PLACEHOLDER. Fee not confirmed by the business.',
    suburbs: ['CBD', 'Yeovil', 'Murambi', 'Morningside'],
    // Minor units: 150 = $1.50. Placeholder, and the row is inactive.
    baseFeeAmount: 150n,
    estimatedMinutesMin: 30,
    estimatedMinutesMax: 60,
  },
  {
    name: 'Zone B — High density',
    description: 'PLACEHOLDER. Fee not confirmed by the business.',
    suburbs: ['Dangamvura', 'Chikanga', 'Sakubva', 'Hobhouse'],
    baseFeeAmount: 200n,
    estimatedMinutesMin: 45,
    estimatedMinutesMax: 90,
  },
]

async function seed() {
  console.log('Seeding Muroora Mart...\n')

  const [existingStore] = await db
    .select()
    .from(stores)
    .where(eq(stores.slug, STORE_SLUG))

  const store =
    existingStore ??
    (
      await db
        .insert(stores)
        .values({
          name: 'Muroora Mart',
          slug: STORE_SLUG,
          isFirstParty: true,
          city: 'Mutare',
          isActive: true,
        })
        .returning()
    )[0]

  console.log(`store   ${existingStore ? 'exists' : 'created'}  ${store.id}`)
  console.log(`\n        Put this in .env.local as NEXT_PUBLIC_STORE_ID\n`)

  let added = 0
  for (const [index, category] of CATEGORIES.entries()) {
    const [existing] = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, category.slug))

    if (existing) continue

    await db.insert(categories).values({
      storeId: store.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      sortOrder: index,
      isActive: true,
    })
    added += 1
  }
  console.log(`categories  ${added} created, ${CATEGORIES.length - added} already present`)

  let zonesAdded = 0
  for (const [index, zone] of ZONES.entries()) {
    const [existing] = await db
      .select()
      .from(deliveryZones)
      .where(eq(deliveryZones.name, zone.name))

    if (existing) continue

    await db.insert(deliveryZones).values({
      storeId: store.id,
      name: zone.name,
      description: zone.description,
      suburbs: zone.suburbs,
      baseFeeAmount: zone.baseFeeAmount,
      currency: 'USD',
      estimatedMinutesMin: zone.estimatedMinutesMin,
      estimatedMinutesMax: zone.estimatedMinutesMax,
      // INACTIVE on purpose — see the note above. An admin activates these
      // once the business has agreed real delivery fees.
      isActive: false,
      sortOrder: index,
    })
    zonesAdded += 1
  }
  console.log(`zones       ${zonesAdded} created (inactive — fees are placeholders)`)

  console.log('\nNo products were seeded. This is an operating shop; the')
  console.log('catalogue is loaded from its real stock list, not invented.')
  console.log('\nDone.')
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\nSeed failed:', error)
    process.exit(1)
  })
