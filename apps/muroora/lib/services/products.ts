import { and, asc, eq, isNull, sql } from 'drizzle-orm'

import { db, type Db } from '@/db/client'
import {
  auditLog,
  categories,
  inventory,
  productImages,
  products,
} from '@/db/schema'
import { applyStockMove } from '@/lib/inventory'
import { fromDecimal, money, toDecimal, type Money } from '@/lib/money'

/**
 * Product and catalogue service.
 *
 * ALL product business logic lives here and nowhere else. Server actions and
 * HTTP route handlers are thin wrappers around these functions — see
 * TASKS.md, and section 56 of the master build prompt: "Keep business logic
 * out of UI components... This will allow a future native app to use the same
 * backend."
 *
 * Nothing in this file imports from `next/*`. That is the test of whether the
 * boundary is real: if it compiles outside a Next request, a native app's
 * backend can call it too.
 *
 * THE ONE RULE THAT MATTERS MOST HERE
 * There are two read paths, and they are separate on purpose:
 *
 *   `listPublicProducts` / `getPublicProduct`  — for customers. Selects
 *       columns explicitly and NEVER includes cost price.
 *   `listAdminProducts`                        — for admins. Includes it.
 *
 * A single "get products" function with a boolean flag would eventually be
 * called with the wrong flag, and the shop's margin would be sitting in a JSON
 * response for anyone who opened the network tab. Two functions cannot be
 * mixed up by accident.
 */

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID!

/* ------------------------------------------------------------------ types */

/** What a customer is allowed to see. Note the absence of cost. */
export interface PublicProduct {
  id: string
  name: string
  slug: string
  sku: string
  brand: string | null
  description: string | null
  unitSize: string | null
  price: Money
  promoPrice: Money | null
  categoryId: string | null
  categoryName: string | null
  categorySlug: string | null
  images: { path: string; alt: string | null }[]
  /** Deliberately not the raw number — see availabilityOf(). */
  availability: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'
}

/** Everything, including what the shop paid. Admin screens only. */
export interface AdminProduct extends PublicProduct {
  costPrice: Money | null
  quantity: number
  reserved: number
  lowStockThreshold: number
  isActive: boolean
}

export interface CreateProductInput {
  name: string
  sku: string
  categoryId: string
  brand?: string
  unitSize?: string
  description?: string
  /** Decimal string as typed, e.g. "12.50". Parsed by lib/money. */
  price: string
  costPrice?: string
  openingStock?: number
  lowStockThreshold?: number
  isActive?: boolean
}

/* -------------------------------------------------------------- helpers */

/**
 * Stock as a state, not a count.
 *
 * Customers get "In stock" / "Only a few left" / "Out of stock", never the
 * exact figure. Publishing a live count tells a competitor your turnover, and
 * it makes the page wrong the moment somebody else checks out.
 */
function availabilityOf(
  quantity: number,
  reserved: number,
  threshold: number,
): PublicProduct['availability'] {
  const sellable = quantity - reserved
  if (sellable <= 0) return 'OUT_OF_STOCK'
  if (sellable <= threshold) return 'LOW_STOCK'
  return 'IN_STOCK'
}

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)

/* ---------------------------------------------------------- public reads */

/**
 * The customer catalogue.
 *
 * Explicit column list, no `select *`. That is what keeps `costPriceAmount`
 * out of the response — a `select *` here would leak it the day somebody adds
 * a column and forgets.
 */
export async function listPublicProducts(options?: {
  categorySlug?: string
  limit?: number
}): Promise<PublicProduct[]> {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      sku: products.sku,
      brand: products.brand,
      description: products.description,
      unitSize: products.unitSize,
      priceAmount: products.priceAmount,
      promoPriceAmount: products.promoPriceAmount,
      lowStockThreshold: products.lowStockThreshold,
      categoryId: categories.id,
      categoryName: categories.name,
      categorySlug: categories.slug,
      quantity: inventory.quantity,
      reserved: inventory.reserved,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(
      and(
        eq(products.storeId, STORE_ID),
        eq(products.isActive, true),
        isNull(products.deletedAt),
        options?.categorySlug
          ? eq(categories.slug, options.categorySlug)
          : undefined,
      ),
    )
    .orderBy(asc(products.name))
    .limit(options?.limit ?? 500)

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    sku: row.sku,
    brand: row.brand,
    description: row.description,
    unitSize: row.unitSize,
    price: money(row.priceAmount, 'USD'),
    promoPrice: row.promoPriceAmount ? money(row.promoPriceAmount, 'USD') : null,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    categorySlug: row.categorySlug,
    images: [],
    availability: availabilityOf(
      row.quantity ?? 0,
      row.reserved ?? 0,
      row.lowStockThreshold,
    ),
  }))
}

export async function getPublicProduct(
  slug: string,
): Promise<PublicProduct | null> {
  const [row] = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      sku: products.sku,
      brand: products.brand,
      description: products.description,
      unitSize: products.unitSize,
      priceAmount: products.priceAmount,
      promoPriceAmount: products.promoPriceAmount,
      lowStockThreshold: products.lowStockThreshold,
      categoryId: categories.id,
      categoryName: categories.name,
      categorySlug: categories.slug,
      quantity: inventory.quantity,
      reserved: inventory.reserved,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(
      and(
        eq(products.storeId, STORE_ID),
        eq(products.slug, slug),
        eq(products.isActive, true),
        isNull(products.deletedAt),
      ),
    )

  if (!row) return null

  const images = await db
    .select({ path: productImages.path, alt: productImages.alt })
    .from(productImages)
    .where(eq(productImages.productId, row.id))
    .orderBy(asc(productImages.sortOrder))

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sku: row.sku,
    brand: row.brand,
    description: row.description,
    unitSize: row.unitSize,
    price: money(row.priceAmount, 'USD'),
    promoPrice: row.promoPriceAmount ? money(row.promoPriceAmount, 'USD') : null,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    categorySlug: row.categorySlug,
    images,
    availability: availabilityOf(
      row.quantity ?? 0,
      row.reserved ?? 0,
      row.lowStockThreshold,
    ),
  }
}

export async function listCategories() {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
    })
    .from(categories)
    .where(
      and(
        eq(categories.storeId, STORE_ID),
        eq(categories.isActive, true),
        isNull(categories.deletedAt),
      ),
    )
    .orderBy(asc(categories.sortOrder))
}

/* ----------------------------------------------------------- admin reads */

/** Includes cost price. Callers MUST have checked for an admin role first. */
export async function listAdminProducts(): Promise<AdminProduct[]> {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      sku: products.sku,
      brand: products.brand,
      description: products.description,
      unitSize: products.unitSize,
      priceAmount: products.priceAmount,
      promoPriceAmount: products.promoPriceAmount,
      costPriceAmount: products.costPriceAmount,
      lowStockThreshold: products.lowStockThreshold,
      isActive: products.isActive,
      categoryId: categories.id,
      categoryName: categories.name,
      categorySlug: categories.slug,
      quantity: inventory.quantity,
      reserved: inventory.reserved,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(and(eq(products.storeId, STORE_ID), isNull(products.deletedAt)))
    .orderBy(asc(products.name))

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    sku: row.sku,
    brand: row.brand,
    description: row.description,
    unitSize: row.unitSize,
    price: money(row.priceAmount, 'USD'),
    promoPrice: row.promoPriceAmount ? money(row.promoPriceAmount, 'USD') : null,
    costPrice: row.costPriceAmount ? money(row.costPriceAmount, 'USD') : null,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    categorySlug: row.categorySlug,
    images: [],
    quantity: row.quantity ?? 0,
    reserved: row.reserved ?? 0,
    lowStockThreshold: row.lowStockThreshold,
    isActive: row.isActive,
    availability: availabilityOf(
      row.quantity ?? 0,
      row.reserved ?? 0,
      row.lowStockThreshold,
    ),
  }))
}

export async function countLowStock(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(products)
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(
      sql`${products.storeId} = ${STORE_ID}
          and ${products.isActive} = true
          and ${products.deletedAt} is null
          and coalesce(${inventory.quantity}, 0) - coalesce(${inventory.reserved}, 0)
              <= ${products.lowStockThreshold}`,
    )
  return row?.n ?? 0
}

/* --------------------------------------------------------------- writes */

export class ProductConflictError extends Error {
  constructor(readonly field: 'sku' | 'slug', value: string) {
    super(
      field === 'sku'
        ? `Stock code "${value}" is already used.`
        : `A product named "${value}" already exists.`,
    )
    this.name = 'ProductConflictError'
  }
}

/**
 * Create a product, its inventory row, and its opening stock movement — all in
 * one transaction, so a failure part-way leaves none of them.
 *
 * Opening stock is recorded as a RESTOCK movement rather than written straight
 * into the balance. The ledger has to be able to explain every unit in the
 * shop, and "it was already there when we started" is not an explanation.
 */
export async function createProduct(
  input: CreateProductInput,
  actorId: string,
): Promise<{ id: string; name: string }> {
  const price = fromDecimal(input.price, 'USD')
  const cost = input.costPrice ? fromDecimal(input.costPrice, 'USD') : null
  const opening = input.openingStock ?? 0

  try {
    return await db.transaction(async (tx) => {
      const [product] = await tx
        .insert(products)
        .values({
          storeId: STORE_ID,
          categoryId: input.categoryId,
          sku: input.sku,
          name: input.name,
          slug: slugify(input.name),
          brand: input.brand || null,
          unitSize: input.unitSize || null,
          description: input.description || null,
          priceAmount: price.amount,
          priceCurrency: 'USD',
          costPriceAmount: cost?.amount ?? null,
          lowStockThreshold: input.lowStockThreshold ?? 5,
          isActive: input.isActive ?? true,
          createdBy: actorId,
        })
        .returning()

      // Explicitly zero, never absent. lib/inventory.ts refuses to move stock
      // for a product with no row, so "no record" and "none left" stay
      // distinguishable.
      await tx.insert(inventory).values({
        storeId: STORE_ID,
        productId: product.id,
        quantity: 0,
        reserved: 0,
      })

      if (opening > 0) {
        await applyStockMove(
          {
            storeId: STORE_ID,
            productId: product.id,
            type: 'RESTOCK',
            quantityChange: opening,
            reason: 'Opening stock at product creation',
            referenceType: 'product_created',
            referenceId: product.id,
            performedBy: actorId,
          },
          tx as unknown as Db,
        )
      }

      await tx.insert(auditLog).values({
        storeId: STORE_ID,
        actorId,
        actorRole: 'ADMIN',
        action: 'PRODUCT_CREATED',
        entityType: 'product',
        entityId: product.id,
        changes: {
          name: input.name,
          sku: input.sku,
          price: toDecimal(price),
          openingStock: opening,
        },
      })

      return { id: product.id, name: product.name }
    })
  } catch (error) {
    const message = String((error as Error).message)
    if (message.includes('products_store_sku')) {
      throw new ProductConflictError('sku', input.sku)
    }
    if (message.includes('products_store_slug')) {
      throw new ProductConflictError('slug', input.name)
    }
    throw error
  }
}

export async function setProductActive(
  productId: string,
  isActive: boolean,
  actorId: string,
): Promise<void> {
  await db
    .update(products)
    .set({ isActive, updatedAt: new Date() })
    .where(and(eq(products.id, productId), eq(products.storeId, STORE_ID)))

  await db.insert(auditLog).values({
    storeId: STORE_ID,
    actorId,
    actorRole: 'ADMIN',
    action: isActive ? 'PRODUCT_SHOWN' : 'PRODUCT_HIDDEN',
    entityType: 'product',
    entityId: productId,
    changes: { isActive },
  })
}
