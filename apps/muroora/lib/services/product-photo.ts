import { createClient } from '@supabase/supabase-js'
import { and, asc, eq, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { auditLog, productImages, products } from '@/db/schema'

/**
 * Product photographs.
 *
 * Unlike staff photos, these are PUBLIC by design. A shop photo is meant to be
 * seen by anybody browsing, it is cached hard by the CDN, and putting signed
 * URLs on a catalogue would mean re-signing every image on every page load for
 * no benefit at all.
 *
 * That difference is the whole reason this is a separate module from
 * staff-photo.ts rather than a flag on it. A boolean called `isPublic` on a
 * shared uploader is one wrong argument away from publishing an employee's
 * face, and nobody would notice until it was indexed.
 */

const BUCKET = 'product-photos'
const MAX_BYTES = 8 * 1024 * 1024
const MAX_PER_PRODUCT = 6

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID!

export class ProductPhotoError extends Error {
  constructor(
    readonly code: 'NOT_FOUND' | 'BAD_FILE' | 'TOO_MANY',
    message: string,
  ) {
    super(message)
    this.name = 'ProductPhotoError'
  }
}

/** Checked against the bytes, not the filename or the declared type. */
const MAGIC: ReadonlyArray<{ ext: string; bytes: number[]; offset?: number }> = [
  { ext: 'jpg', bytes: [0xff, 0xd8, 0xff] },
  { ext: 'png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { ext: 'webp', bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
]

function sniff(buffer: Uint8Array): string | null {
  for (const type of MAGIC) {
    const at = type.offset ?? 0
    if (buffer.length < at + type.bytes.length) continue
    if (type.bytes.every((b, i) => buffer[at + i] === b)) return type.ext
  }
  return null
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new ProductPhotoError('BAD_FILE', 'Photo storage is not configured.')
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function ensureProductBucket(): Promise<void> {
  const supabase = admin()
  const { data } = await supabase.storage.listBuckets()
  if (data?.some((b) => b.name === BUCKET)) return
  await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  })
}

/** The public URL for a stored path. */
export function productPhotoUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
}

export async function addProductPhoto(params: {
  productId: string
  file: File
  alt?: string
  actorId: string
  /** Business workspaces pass their resolved store. Legacy shop admin calls
   * keep using the configured founding-store id. */
  storeId?: string
}): Promise<{ path: string; url: string }> {
  const [product] = await db
    .select({ id: products.id, name: products.name, sku: products.sku })
    .from(products)
    .where(
      and(eq(products.id, params.productId), eq(products.storeId, params.storeId ?? STORE_ID)),
    )

  if (!product) throw new ProductPhotoError('NOT_FOUND', 'No such product.')

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(productImages)
    .where(eq(productImages.productId, product.id))

  if (n >= MAX_PER_PRODUCT) {
    throw new ProductPhotoError(
      'TOO_MANY',
      `That product already has ${MAX_PER_PRODUCT} photos. Remove one first.`,
    )
  }

  if (params.file.size === 0) {
    throw new ProductPhotoError('BAD_FILE', 'That file is empty.')
  }
  if (params.file.size > MAX_BYTES) {
    throw new ProductPhotoError(
      'BAD_FILE',
      `That photo is ${(params.file.size / 1024 / 1024).toFixed(1)}MB. The ` +
        `limit is 8MB. Most phones can send a smaller copy.`,
    )
  }

  const bytes = new Uint8Array(await params.file.arrayBuffer())
  const ext = sniff(bytes)
  if (!ext) {
    throw new ProductPhotoError(
      'BAD_FILE',
      'That does not look like a photo. Use a JPG, PNG or WEBP.',
    )
  }

  await ensureProductBucket()
  const supabase = admin()
  const path = `${product.sku ?? product.id}/${Date.now()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType:
      ext === 'jpg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : 'image/webp',
    upsert: false,
    cacheControl: '31536000',
  })

  if (error) {
    throw new ProductPhotoError('BAD_FILE', `Could not save it: ${error.message}`)
  }

  await db.insert(productImages).values({
    productId: product.id,
    path,
    // Falls back to the product name so the image is never unlabelled. An
    // empty alt on a shop photo is a product a screen reader cannot describe.
    alt: params.alt?.trim() || product.name,
    sortOrder: n,
  })

  await db.insert(auditLog).values({
    storeId: STORE_ID,
    actorId: params.actorId,
    actorRole: 'STAFF',
    action: 'PRODUCT_PHOTO_ADDED',
    entityType: 'product',
    entityId: product.id,
    changes: { product: product.name, path },
  })

  return { path, url: productPhotoUrl(path) }
}

export async function removeProductPhoto(params: {
  imageId: string
  actorId: string
}): Promise<void> {
  const [image] = await db
    .select()
    .from(productImages)
    .where(eq(productImages.id, params.imageId))

  if (!image) throw new ProductPhotoError('NOT_FOUND', 'No such photo.')

  await db.delete(productImages).where(eq(productImages.id, image.id))

  const supabase = admin()
  await supabase.storage.from(BUCKET).remove([image.path])

  await db.insert(auditLog).values({
    storeId: STORE_ID,
    actorId: params.actorId,
    actorRole: 'STAFF',
    action: 'PRODUCT_PHOTO_REMOVED',
    entityType: 'product',
    entityId: image.productId,
    changes: { path: image.path },
  })
}

/** Every photo for a product, in display order. */
export async function listProductPhotos(productId: string) {
  const rows = await db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt))

  return rows.map((r) => ({ ...r, url: productPhotoUrl(r.path) }))
}

/** First photo per product, for the catalogue grid. One query, not N. */
export async function firstPhotoByProduct(): Promise<Map<string, string>> {
  const rows = await db
    .select({
      productId: productImages.productId,
      path: productImages.path,
      sortOrder: productImages.sortOrder,
    })
    .from(productImages)
    .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt))

  const map = new Map<string, string>()
  for (const r of rows) {
    if (!map.has(r.productId)) map.set(r.productId, productPhotoUrl(r.path))
  }
  return map
}
