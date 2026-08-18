'use client'

import { useActionState } from 'react'
import {
  createBusinessProductAction,
  setBusinessProductPublicationAction,
  updateBusinessProfileAction,
  addBusinessProductPhotoAction,
  type BusinessActionState,
} from './actions'

const field = 'mt-2 w-full border border-rule bg-paper px-4 py-3 focus:border-accent focus:outline-none'

function Result({ state }: { state: BusinessActionState }) {
  return state.error || state.message ? (
    <p role={state.error ? 'alert' : 'status'} className="mt-4 text-small">
      {state.error ?? state.message}
    </p>
  ) : null
}

function ProductPhotoUpload({ businessId, productId, canWrite }: { businessId: string; productId: string; canWrite: boolean }) {
  const [state, action] = useActionState(addBusinessProductPhotoAction.bind(null, businessId), {})
  return <form action={action} className="mt-3 flex flex-wrap items-center gap-2">
    <input type="hidden" name="productId" value={productId} />
    <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required disabled={!canWrite} className="max-w-56 text-small" />
    <input name="alt" aria-label="Photo description" placeholder="Photo description" className="border border-rule px-2 py-1 text-small" />
    <button disabled={!canWrite} className="border border-rule px-3 py-1 text-small font-bold">Upload photo</button>
    <Result state={state} />
  </form>
}

export function BusinessWorkspace({ businessId, canWrite, profile, categories, products }: {
  businessId: string
  canWrite: boolean
  profile: { summary: string | null; websiteUrl: string | null; whatsappNumber: string | null; faviconPath: string | null }
  categories: { id: string; name: string }[]
  products: { id: string; name: string; sku: string; price: string; quantity: number; publishToMusuwo: boolean }[]
}) {
  const [productState, productAction] = useActionState(createBusinessProductAction.bind(null, businessId), {})
  const [profileState, profileAction] = useActionState(updateBusinessProfileAction.bind(null, businessId), {})

  return <>
    <section className="border-b border-rule py-10">
      <h2 className="text-h2">Public business profile</h2>
      <p className="mt-2 text-ink-soft">These are public links customers may use. WhatsApp is never copied from private application details.</p>
      <form action={profileAction} className="mt-6 grid gap-5 sm:grid-cols-2">
        <label className="sm:col-span-2">Description<textarea name="summary" defaultValue={profile.summary ?? ''} rows={3} className={field} /></label>
        <label>Website URL<input name="websiteUrl" type="url" defaultValue={profile.websiteUrl ?? ''} placeholder="https://yourbusiness.co.zw" className={field} /></label>
        <label>WhatsApp number<input name="whatsappNumber" defaultValue={profile.whatsappNumber ?? ''} placeholder="+263 77 000 0000" className={field} /></label>
        <label className="sm:col-span-2">Favicon or square logo URL<input name="faviconPath" type="url" defaultValue={profile.faviconPath ?? ''} placeholder="https://…/icon.png" className={field} /></label>
        <button disabled={!canWrite} className="w-fit bg-support px-6 py-3 font-bold text-white disabled:opacity-50">Save profile</button>
      </form>
      <Result state={profileState} />
    </section>

    <section className="border-b border-rule py-10">
      <h2 className="text-h2">Add a product</h2>
      <form action={productAction} className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <label>Product name<input required name="name" className={field} /></label>
        <label>Stock code<input required name="sku" className={field} /></label>
        <label>Category<select required name="categoryId" className={field}><option value="">Choose…</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Price (USD)<input required name="price" inputMode="decimal" placeholder="12.50" className={field} /></label>
        <label>Opening stock<input required name="openingStock" type="number" min="0" defaultValue="0" className={field} /></label>
        <label>Size or unit<input name="unitSize" placeholder="2kg, one hour…" className={field} /></label>
        <label className="sm:col-span-2 lg:col-span-3">Description<textarea name="description" rows={3} className={field} /></label>
        <label className="flex items-center gap-3"><input type="checkbox" name="publish" value="true" /> Publish to Musuwo now</label>
        <button disabled={!canWrite} className="w-fit bg-accent px-6 py-3 font-bold text-white disabled:opacity-50">Add product</button>
      </form>
      <Result state={productState} />
    </section>

    <section className="py-10">
      <h2 className="text-h2">Your products</h2>
      {products.length === 0 ? <p className="mt-5 text-ink-soft">No products yet.</p> : <div className="mt-6 grid gap-4">{products.map(product =>
        <article key={product.id} className="flex flex-wrap items-center justify-between gap-4 border border-rule p-5">
          <div><h3 className="font-bold">{product.name}</h3><p className="text-small text-ink-soft">{product.sku} · ${product.price} · {product.quantity} in stock</p><ProductPhotoUpload businessId={businessId} productId={product.id} canWrite={canWrite} /></div>
          <button disabled={!canWrite} onClick={() => setBusinessProductPublicationAction(businessId, product.id, !product.publishToMusuwo)} className="border border-support px-4 py-2 text-small font-bold text-support disabled:opacity-50">
            {product.publishToMusuwo ? 'Remove from Musuwo' : 'Publish to Musuwo'}
          </button>
        </article>)}</div>}
    </section>
  </>
}
