'use client'

import { useActionState, useRef } from 'react'
import { useFormStatus } from 'react-dom'

import {
  createProductAction,
  type ProductFormState,
} from '@/app/admin/products/actions'

/**
 * Add a product.
 *
 * Laid out in the order somebody holding the item would fill it in: what it
 * is, what it costs, how many are there. Opening stock is on the same form on
 * purpose — a product entered without its stock count is a product that has to
 * be visited twice.
 */

const field =
  'mt-2 w-full border border-rule bg-paper px-4 py-3 text-body focus:border-accent focus:outline-none'
const label =
  'block font-mono text-micro uppercase tracking-label text-ink-faint'

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-accent px-8 py-4 font-mono text-small font-bold uppercase tracking-label text-white transition-colors hover:bg-accent-deep disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Add product'}
    </button>
  )
}

export function AddProductForm({
  categories,
}: {
  categories: { id: string; name: string }[]
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction] = useActionState<ProductFormState, FormData>(
    async (prev, data) => {
      const result = await createProductAction(prev, data)
      // Clear only on success, so a rejected entry is not lost and retyped.
      if (result.message) formRef.current?.reset()
      return result
    },
    {},
  )

  return (
    <form ref={formRef} action={formAction} className="mt-6 max-w-4xl">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2">
          <label htmlFor="name" className={label}>
            Product name
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="Mealie meal"
            className={field}
          />
        </div>

        <div>
          <label htmlFor="sku" className={label}>
            Stock code
          </label>
          <input
            id="sku"
            name="sku"
            required
            placeholder="MM-MEAL-10"
            className={field}
          />
        </div>

        <div>
          <label htmlFor="categoryId" className={label}>
            Category
          </label>
          <select id="categoryId" name="categoryId" required className={field}>
            <option value="">Choose…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="unitSize" className={label}>
            Size <span className="normal-case">(optional)</span>
          </label>
          <input
            id="unitSize"
            name="unitSize"
            placeholder="10kg"
            className={field}
          />
        </div>

        <div>
          <label htmlFor="brand" className={label}>
            Brand <span className="normal-case">(optional)</span>
          </label>
          <input id="brand" name="brand" className={field} />
        </div>

        <div>
          <label htmlFor="price" className={label}>
            Selling price (USD)
          </label>
          <input
            id="price"
            name="price"
            required
            inputMode="decimal"
            placeholder="12.50"
            className={field}
          />
        </div>

        <div>
          <label htmlFor="costPrice" className={label}>
            What you paid <span className="normal-case">(optional)</span>
          </label>
          <input
            id="costPrice"
            name="costPrice"
            inputMode="decimal"
            placeholder="9.00"
            className={field}
          />
          <p className="mt-2 text-small text-ink-faint">
            Never shown to customers.
          </p>
        </div>

        <div>
          <label htmlFor="openingStock" className={label}>
            How many do you have
          </label>
          <input
            id="openingStock"
            name="openingStock"
            type="number"
            min={0}
            defaultValue={0}
            inputMode="numeric"
            className={field}
          />
        </div>

        <div>
          <label htmlFor="lowStockThreshold" className={label}>
            Warn me below
          </label>
          <input
            id="lowStockThreshold"
            name="lowStockThreshold"
            type="number"
            min={0}
            defaultValue={5}
            inputMode="numeric"
            className={field}
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-3">
          <label htmlFor="description" className={label}>
            Description <span className="normal-case">(optional)</span>
          </label>
          <textarea
            id="description"
            name="description"
            rows={2}
            className={field}
          />
        </div>
      </div>

      <label className="mt-6 flex items-center gap-3">
        <input
          type="checkbox"
          name="isActive"
          value="true"
          defaultChecked
          className="h-4 w-4 accent-[var(--color-accent)]"
        />
        <span className="text-small">Show in the shop straight away</span>
      </label>

      {state.error && (
        <p
          role="alert"
          className="mt-6 max-w-2xl border-l-4 border-accent bg-accent-wash px-4 py-3 text-small"
        >
          {state.error}
        </p>
      )}
      {state.message && (
        <p
          role="status"
          className="mt-6 max-w-2xl border-l-4 border-support bg-paper-sunk px-4 py-3 text-small"
        >
          {state.message}
        </p>
      )}

      <div className="mt-8">
        <Submit />
      </div>
    </form>
  )
}
