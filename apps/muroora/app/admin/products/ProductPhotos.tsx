'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  addProductPhotoAction,
  removeProductPhotoAction,
  type ProductFormState,
} from '@/app/admin/products/actions'

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-ink px-3 py-1.5 font-mono text-micro uppercase tracking-label transition-colors hover:bg-ink hover:text-paper disabled:opacity-50"
    >
      {pending ? '…' : label}
    </button>
  )
}

/**
 * Photos for one product.
 *
 * Sits in the product row rather than behind an "edit product" screen, because
 * filling a shop means going down the list adding a picture to each thing, and
 * a round trip through a separate form for every item is how a catalogue ends
 * up with no pictures.
 *
 * `capture="environment"` opens the rear camera on a phone: the realistic way
 * this gets done is somebody standing in the shop photographing the shelf.
 */
export function ProductPhotos({
  productId,
  productName,
  photos,
}: {
  productId: string
  productName: string
  photos: { id: string; url: string; alt: string | null }[]
}) {
  const [addState, addAction] = useActionState<ProductFormState, FormData>(
    addProductPhotoAction,
    {},
  )
  const [removeState, removeAction] = useActionState<ProductFormState, FormData>(
    removeProductPhotoAction,
    {},
  )

  return (
    <div className="min-w-[13rem] space-y-3">
      {photos.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {photos.map((photo) => (
            <li key={photo.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.alt ?? productName}
                width={56}
                height={56}
                className="size-14 border border-rule object-cover"
              />
              <form action={removeAction}>
                <input type="hidden" name="imageId" value={photo.id} />
                <button
                  type="submit"
                  aria-label={`Remove this photo of ${productName}`}
                  className="absolute -right-2 -top-2 flex size-6 items-center justify-center border border-ink bg-paper font-mono text-micro leading-none transition-colors hover:bg-accent hover:text-white"
                >
                  x
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={addAction} className="space-y-2">
        <input type="hidden" name="productId" value={productId} />
        <input
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          required
          aria-label={`Add a photo of ${productName}`}
          className="block w-full text-small file:mr-3 file:border file:border-rule file:bg-paper file:px-3 file:py-1.5 file:font-mono file:text-micro file:uppercase file:tracking-label"
        />
        <Submit label={photos.length ? 'Add another' : 'Add photo'} />
      </form>

      {(addState.error ?? removeState.error) && (
        <p role="alert" className="text-small text-accent">
          {addState.error ?? removeState.error}
        </p>
      )}
      {(addState.message ?? removeState.message) && (
        <p role="status" className="text-small text-support">
          {addState.message ?? removeState.message}
        </p>
      )}
    </div>
  )
}
