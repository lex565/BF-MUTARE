'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireAdminWrite, requireRole } from '@/lib/auth'
import {
  ProductPhotoError,
  addProductPhoto,
  removeProductPhoto,
} from '@/lib/services/product-photo'
import { applyStockMove } from '@/lib/inventory'
import {
  ProductConflictError,
  createProduct,
  setProductActive,
} from '@/lib/services/products'

/**
 * Admin server actions.
 *
 * THIN WRAPPERS ONLY. Each one does exactly three things:
 *   1. check the caller's role,
 *   2. validate the form input,
 *   3. call the service in lib/services/*.
 *
 * No business logic lives here. That is section 56 of the brief - logic stays
 * out of the UI layer so a future native app can reach the same behaviour
 * through app/api/* rather than a Next server action it cannot invoke.
 *
 * `requireRole` is at the top of EVERY action, and that is the real security
 * boundary, not the middleware. A server action is an HTTP endpoint: anyone
 * who knows its id can call it without ever loading the page middleware
 * protects.
 */

const decimal = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, 'Use a price like 12.50')

const productInput = z.object({
  name: z.string().trim().min(2, 'Give the product a name.').max(200),
  sku: z.string().trim().min(1, 'Give it a stock code.').max(60),
  categoryId: z.string().uuid('Pick a category.'),
  brand: z.string().trim().max(120).optional().or(z.literal('')),
  unitSize: z.string().trim().max(60).optional().or(z.literal('')),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  price: decimal,
  costPrice: decimal.optional().or(z.literal('')),
  openingStock: z.coerce.number().int().min(0).max(1_000_000).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).max(10_000).default(5),
  isActive: z.coerce.boolean().default(true),
})

export type ProductFormState = { error?: string; message?: string }

export async function createProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const user = await requireAdminWrite()

  const parsed = productInput.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    const product = await createProduct(
      {
        ...parsed.data,
        brand: parsed.data.brand || undefined,
        unitSize: parsed.data.unitSize || undefined,
        description: parsed.data.description || undefined,
        costPrice: parsed.data.costPrice || undefined,
      },
      user.id,
    )

    revalidatePath('/admin/products')
    revalidatePath('/shop')
    return { message: `Added ${product.name}.` }
  } catch (error) {
    if (error instanceof ProductConflictError) {
      return { error: error.message }
    }
    console.error('[createProductAction]', error)
    return { error: 'Could not save that product.' }
  }
}

const stockInput = z.object({
  productId: z.string().uuid(),
  /** Signed: -3 removes three. */
  change: z.coerce.number().int().refine((n) => n !== 0, 'Enter an amount.'),
  type: z.enum(['RESTOCK', 'DAMAGED', 'LOST', 'RETURN', 'MANUAL_ADJUSTMENT']),
  reason: z.string().trim().max(300).optional().or(z.literal('')),
})

export async function adjustStockAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const user = await requireAdminWrite()

  const parsed = stockInput.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    const result = await applyStockMove({
      storeId: process.env.NEXT_PUBLIC_STORE_ID!,
      productId: parsed.data.productId,
      type: parsed.data.type,
      quantityChange: parsed.data.change,
      reason: parsed.data.reason || undefined,
      referenceType: 'admin_adjustment',
      performedBy: user.id,
    })

    revalidatePath('/admin/products')
    revalidatePath('/shop')
    return {
      message: `Stock ${result.quantityBefore} → ${result.quantityAfter}.`,
    }
  } catch (error) {
    // Stock errors are safe to show: "you only have 3 left" is exactly what
    // the person needs to read, and reveals nothing they cannot already see.
    return { error: String((error as Error).message).slice(0, 200) }
  }
}

export async function toggleProductActiveAction(
  productId: string,
  isActive: boolean,
): Promise<ProductFormState> {
  const user = await requireAdminWrite()

  await setProductActive(productId, isActive, user.id)

  revalidatePath('/admin/products')
  revalidatePath('/shop')
  return { message: isActive ? 'Now in the shop.' : 'Hidden from the shop.' }
}

/* ------------------------------------------------------- product photos */

/**
 * Add a photo to a product.
 *
 * SHOP_STAFF may do this, not only admins. The shop manager fills the shelves,
 * and making him ask an admin to attach every picture would mean the pictures
 * never get attached. Prices and cost stay admin-only; a photograph is not a
 * commercial decision.
 */
export async function addProductPhotoAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const user = await requireRole('SHOP_STAFF', 'ADMIN', 'SUPER_ADMIN')

  const productId = String(formData.get('productId') ?? '')
  const file = formData.get('photo')
  const alt = String(formData.get('alt') ?? '')

  if (!productId) return { error: 'Which product?' }
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose a photo first.' }
  }

  try {
    await addProductPhoto({ productId, file, alt, actorId: user.id })
    revalidatePath('/admin/products')
    revalidatePath('/shop')
    return { message: 'Photo added.' }
  } catch (error) {
    if (error instanceof ProductPhotoError) return { error: error.message }
    console.error('[addProductPhotoAction]', error)
    return { error: 'Could not add that photo.' }
  }
}

export async function removeProductPhotoAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const user = await requireRole('SHOP_STAFF', 'ADMIN', 'SUPER_ADMIN')

  const imageId = String(formData.get('imageId') ?? '')
  if (!imageId) return { error: 'Which photo?' }

  try {
    await removeProductPhoto({ imageId, actorId: user.id })
    revalidatePath('/admin/products')
    revalidatePath('/shop')
    return { message: 'Photo removed.' }
  } catch (error) {
    if (error instanceof ProductPhotoError) return { error: error.message }
    console.error('[removeProductPhotoAction]', error)
    return { error: 'Could not remove that photo.' }
  }
}
