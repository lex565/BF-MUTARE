'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { currentUser } from '@/lib/auth'
import { createBusinessProduct, updateBusinessProfile } from '@/lib/services/business-catalogue'
import { setProductPublication } from '@/lib/services/marketplace'
import { addProductPhoto, ProductPhotoError } from '@/lib/services/product-photo'
import { requireMembership } from '@/lib/services/marketplace'

export type BusinessActionState = { error?: string; message?: string }

async function signedIn() {
  const user = await currentUser()
  if (!user) throw new Error('Sign in again to continue.')
  return user
}

export async function createBusinessProductAction(
  businessId: string,
  _previous: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  const input = z.object({
    name: z.string().trim().min(2).max(200),
    sku: z.string().trim().min(1).max(60),
    categoryId: z.string().uuid(),
    description: z.string().trim().max(2000).optional(),
    unitSize: z.string().trim().max(60).optional(),
    price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Use a price like 12.50'),
    openingStock: z.coerce.number().int().min(0).max(1_000_000),
  }).safeParse(Object.fromEntries(formData))
  if (!input.success) return { error: input.error.issues[0].message }

  try {
    const user = await signedIn()
    const product = await createBusinessProduct({
      ...input.data,
      userId: user.id,
      businessId,
      publish: formData.get('publish') === 'true',
    })
    revalidatePath(`/business/${businessId}`)
    revalidatePath('/shop')
    return { message: `${product.name} was added.` }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function updateBusinessProfileAction(
  businessId: string,
  _previous: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  const optionalUrl = z.union([z.literal(''), z.string().url()])
  const input = z.object({
    summary: z.string().trim().max(600),
    websiteUrl: optionalUrl,
    whatsappNumber: z.string().trim().max(30).regex(/^$|^\+?[0-9 ]+$/, 'Use a phone number with country code.'),
    faviconPath: optionalUrl,
  }).safeParse(Object.fromEntries(formData))
  if (!input.success) return { error: input.error.issues[0].message }
  try {
    const user = await signedIn()
    await updateBusinessProfile({ ...input.data, userId: user.id, businessId })
    revalidatePath(`/business/${businessId}`)
    revalidatePath('/marketplace')
    revalidatePath('/shop')
    return { message: 'Business profile saved.' }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function setBusinessProductPublicationAction(
  businessId: string,
  productId: string,
  publish: boolean,
) {
  const user = await signedIn()
  await setProductPublication({ userId: user.id, businessId, productId, publish })
  revalidatePath(`/business/${businessId}`)
  revalidatePath('/shop')
}

export async function addBusinessProductPhotoAction(
  businessId: string,
  _previous: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  const productId = String(formData.get('productId') ?? '')
  const file = formData.get('photo')
  if (!productId || !(file instanceof File) || file.size === 0) return { error: 'Choose a product photo.' }
  try {
    const user = await signedIn()
    const membership = await requireMembership(user.id, businessId, { write: true })
    if (!membership.storeId) return { error: 'This business has no catalogue.' }
    await addProductPhoto({ productId, file, alt: String(formData.get('alt') ?? ''), actorId: user.id, storeId: membership.storeId })
    revalidatePath(`/business/${businessId}`)
    revalidatePath('/shop')
    return { message: 'Product photo uploaded.' }
  } catch (error) {
    return { error: error instanceof ProductPhotoError ? error.message : (error as Error).message }
  }
}
