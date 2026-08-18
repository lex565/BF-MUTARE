import { and, asc, eq, isNull } from 'drizzle-orm'

import { db, type Db } from '@/db/client'
import { auditLog, businesses, categories, inventory, products } from '@/db/schema'
import { applyStockMove } from '@/lib/inventory'
import { fromDecimal } from '@/lib/money'
import { requireMembership } from '@/lib/services/marketplace'
import { slugify } from '@/lib/services/products'

export async function businessCatalogue(userId: string, businessId: string) {
  const membership = await requireMembership(userId, businessId)
  const [profile] = await db.select({
    summary: businesses.summary,
    websiteUrl: businesses.websiteUrl,
    whatsappNumber: businesses.whatsappNumber,
    faviconPath: businesses.faviconPath,
  }).from(businesses).where(eq(businesses.id, membership.businessId))
  if (!membership.storeId) return { membership, profile, categories: [], products: [] }

  const [categoryRows, productRows] = await Promise.all([
    db.select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(and(eq(categories.storeId, membership.storeId), isNull(categories.deletedAt)))
      .orderBy(asc(categories.sortOrder), asc(categories.name)),
    db.select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      description: products.description,
      priceAmount: products.priceAmount,
      isActive: products.isActive,
      publishToMusuwo: products.publishToMusuwo,
      quantity: inventory.quantity,
    })
      .from(products)
      .leftJoin(inventory, eq(inventory.productId, products.id))
      .where(and(eq(products.storeId, membership.storeId), isNull(products.deletedAt)))
      .orderBy(asc(products.name)),
  ])

  return {
    membership,
    profile,
    categories: categoryRows,
    products: productRows.map((row) => ({
      ...row,
      price: (Number(row.priceAmount) / 100).toFixed(2),
      quantity: row.quantity ?? 0,
    })),
  }
}

export async function createBusinessProduct(params: {
  userId: string
  businessId: string
  name: string
  sku: string
  categoryId: string
  description?: string
  unitSize?: string
  price: string
  openingStock: number
  publish: boolean
}) {
  const membership = await requireMembership(params.userId, params.businessId, { write: true })
  if (!membership.storeId) throw new Error('This business has no catalogue.')
  const storeId = membership.storeId
  const [category] = await db.select({ id: categories.id }).from(categories)
    .where(and(eq(categories.id, params.categoryId), eq(categories.storeId, storeId)))
  if (!category) throw new Error('Choose a category from this business.')
  const price = fromDecimal(params.price, 'USD')

  return db.transaction(async (tx) => {
    const [product] = await tx.insert(products).values({
      storeId,
      categoryId: category.id,
      name: params.name,
      slug: slugify(params.name),
      sku: params.sku,
      description: params.description || null,
      unitSize: params.unitSize || null,
      priceAmount: price.amount,
      priceCurrency: 'USD',
      isActive: true,
      publishToMusuwo: params.publish,
      publishedToMusuwoAt: params.publish ? new Date() : null,
      publishedToMusuwoBy: params.publish ? params.userId : null,
      createdBy: params.userId,
    }).returning({ id: products.id, name: products.name })

    await tx.insert(inventory).values({ storeId, productId: product.id, quantity: 0, reserved: 0 })
    if (params.openingStock > 0) {
      await applyStockMove({
        storeId,
        productId: product.id,
        type: 'RESTOCK',
        quantityChange: params.openingStock,
        reason: 'Opening stock at product creation',
        referenceType: 'product_created',
        referenceId: product.id,
        performedBy: params.userId,
      }, tx as unknown as Db)
    }
    await tx.insert(auditLog).values({
      storeId,
      actorId: params.userId,
      actorRole: 'ADMIN',
      action: 'PRODUCT_CREATED',
      entityType: 'product',
      entityId: product.id,
      changes: { businessId: params.businessId, publishToMusuwo: params.publish },
    })
    return product
  })
}

export async function updateBusinessProfile(params: {
  userId: string
  businessId: string
  summary?: string
  websiteUrl?: string
  whatsappNumber?: string
  faviconPath?: string
}) {
  await requireMembership(params.userId, params.businessId, { write: true })
  await db.update(businesses).set({
    summary: params.summary || null,
    websiteUrl: params.websiteUrl || null,
    whatsappNumber: params.whatsappNumber || null,
    faviconPath: params.faviconPath || null,
    updatedAt: new Date(),
  }).where(eq(businesses.id, params.businessId))
}
