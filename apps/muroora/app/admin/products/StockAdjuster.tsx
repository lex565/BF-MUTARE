'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { adjustStockAction, type ProductFormState } from '@/app/admin/products/actions'

/**
 * Adjust one product's stock.
 *
 * The type is a required choice rather than a free number, because "the count
 * went from 40 to 36" is not useful six months later and "4 damaged in
 * transit" is. Damage, loss and manual corrections also require a reason —
 * lib/inventory.ts refuses them without one.
 */

const TYPES = [
  { value: 'RESTOCK', label: 'Delivery in', sign: +1 },
  { value: 'DAMAGED', label: 'Damaged', sign: -1 },
  { value: 'LOST', label: 'Lost', sign: -1 },
  { value: 'RETURN', label: 'Returned by customer', sign: +1 },
  { value: 'MANUAL_ADJUSTMENT', label: 'Recount', sign: 0 },
] as const

const NEEDS_REASON = new Set(['DAMAGED', 'LOST', 'MANUAL_ADJUSTMENT'])

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-ink px-4 py-2 font-mono text-micro uppercase tracking-label transition-colors hover:bg-ink hover:text-paper disabled:opacity-50"
    >
      {pending ? '…' : 'Apply'}
    </button>
  )
}

export function StockAdjuster({
  productId,
  productName,
}: {
  productId: string
  productName: string
}) {
  const [type, setType] = useState<string>('RESTOCK')
  const [state, formAction] = useActionState<ProductFormState, FormData>(
    adjustStockAction,
    {},
  )

  const selected = TYPES.find((t) => t.value === type)!
  const reasonRequired = NEEDS_REASON.has(type)

  return (
    <form action={formAction} className="min-w-[15rem] space-y-2">
      <input type="hidden" name="productId" value={productId} />

      <div className="flex gap-2">
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          aria-label={`Stock change type for ${productName}`}
          className="w-full border border-rule bg-paper px-2 py-2 text-small focus:border-accent focus:outline-none"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <input
          name="change"
          type="number"
          required
          placeholder={selected.sign < 0 ? '-1' : '1'}
          aria-label={`Amount for ${productName}`}
          className="w-24 border border-rule bg-paper px-2 py-2 text-small tabular-nums focus:border-accent focus:outline-none"
        />
      </div>

      {reasonRequired && (
        <input
          name="reason"
          required
          placeholder="Why? e.g. broken in transit"
          aria-label={`Reason for ${productName}`}
          className="w-full border border-rule bg-paper px-2 py-2 text-small focus:border-accent focus:outline-none"
        />
      )}

      <div className="flex items-center gap-3">
        <Submit />
        {selected.sign < 0 && (
          <span className="font-mono text-micro text-ink-faint">
            use a minus number
          </span>
        )}
      </div>

      {state.error && (
        <p role="alert" className="text-small text-accent">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-small text-support">
          {state.message}
        </p>
      )}
    </form>
  )
}
