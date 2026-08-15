import { relations } from 'drizzle-orm'
import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import { currencyEnum, id, softDelete, storeId, timestamps } from './_shared'
import { users } from './identity'

/**
 * Stores, categories and products.
 *
 * There is one store. `stores` exists anyway, because every other table
 * references it and the alternative — adding tenancy later — means backfilling
 * every row and rewriting every query. See D-002.
 */

export const stores = pgTable('stores', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  /** False for a future third-party merchant. Muroora Mart is the only true. */
  isFirstParty: boolean('is_first_party').notNull().default(false),
  city: text('city').notNull().default('Mutare'),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps(),
})

export const categories = pgTable(
  'categories',
  {
    id: id(),
    storeId: storeId().references(() => stores.id),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    /** Self-reference for subcategories. The brief asks for both levels. */
    parentId: uuid('parent_id'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    unique('categories_store_slug').on(t.storeId, t.slug),
    index('categories_parent_idx').on(t.parentId),
  ],
)

export const products = pgTable(
  'products',
  {
    id: id(),
    storeId: storeId().references(() => stores.id),
    categoryId: uuid('category_id').references(() => categories.id),

    sku: text('sku').notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    brand: text('brand'),
    description: text('description'),
    /** "2kg", "750ml", "12-pack" — how the shop actually sells it. */
    unitSize: text('unit_size'),

    /* ---- Money. Minor units, always with a currency. See lib/money.ts. ---- */

    priceAmount: bigint('price_amount', { mode: 'bigint' }).notNull(),
    priceCurrency: currencyEnum('price_currency').notNull().default('USD'),

    /** Set while on offer, null otherwise. Null is not zero. */
    promoPriceAmount: bigint('promo_price_amount', { mode: 'bigint' }),

    /**
     * What the shop paid. ADMIN-ONLY.
     *
     * This must never reach a customer-facing query. The read helpers in
     * lib/catalogue.ts select columns explicitly rather than `select *` for
     * exactly this reason — a `select *` on a product row leaks the shop's
     * margin to anyone who opens the network tab.
     */
    costPriceAmount: bigint('cost_price_amount', { mode: 'bigint' }),

    lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
    isFeatured: boolean('is_featured').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),

    createdBy: uuid('created_by').references(() => users.id),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    unique('products_store_sku').on(t.storeId, t.sku),
    unique('products_store_slug').on(t.storeId, t.slug),
    index('products_category_idx').on(t.categoryId),
    index('products_active_idx').on(t.storeId, t.isActive),
  ],
)

export const productImages = pgTable(
  'product_images',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    /** Supabase Storage path, not a public URL — resolved at render time. */
    path: text('path').notNull(),
    alt: text('alt'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (t) => [index('product_images_product_idx').on(t.productId)],
)

export const storesRelations = relations(stores, ({ many }) => ({
  categories: many(categories),
  products: many(products),
}))

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  store: one(stores, { fields: [categories.storeId], references: [stores.id] }),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'category_parent',
  }),
  children: many(categories, { relationName: 'category_parent' }),
  products: many(products),
}))

export const productsRelations = relations(products, ({ one, many }) => ({
  store: one(stores, { fields: [products.storeId], references: [stores.id] }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  images: many(productImages),
}))

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}))
