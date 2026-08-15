'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  createZoneAction,
  setZoneActiveAction,
  type ZoneFormState,
} from '@/app/admin/delivery/actions'

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-ink px-5 py-2 font-mono text-micro uppercase tracking-label transition-colors hover:bg-ink hover:text-paper disabled:opacity-50"
    >
      {pending ? '…' : label}
    </button>
  )
}

const field =
  'mt-1 w-full border border-rule bg-paper px-3 py-2 text-small focus:border-accent focus:outline-none'
const label =
  'block font-mono text-micro uppercase tracking-label text-ink-faint'

export function AddZoneForm() {
  const [state, formAction] = useActionState<ZoneFormState, FormData>(
    createZoneAction,
    {},
  )

  return (
    <form action={formAction} className="mt-6 max-w-3xl space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Area name</span>
          <input
            name="name"
            required
            placeholder="e.g. Dangamvura"
            className={field}
          />
        </label>

        <label className="block">
          <span className={label}>Delivery fee (USD)</span>
          <input
            name="fee"
            required
            inputMode="decimal"
            placeholder="3.00"
            className={field}
          />
        </label>
      </div>

      <label className="block">
        <span className={label}>Suburbs this covers</span>
        <textarea
          name="suburbs"
          required
          rows={3}
          placeholder="Dangamvura, Chikanga, Hobhouse"
          className={field}
        />
        <span className="mt-1 block text-small text-ink-faint">
          Separate them with commas. Spelling and capitals do not matter when a
          customer types it, but a suburb can only be in one area.
        </span>
      </label>

      <div className="grid gap-5 sm:grid-cols-3">
        <label className="block">
          <span className={label}>Smallest order (USD)</span>
          <input
            name="minimumOrder"
            inputMode="decimal"
            placeholder="0.00"
            className={field}
          />
        </label>
        <label className="block">
          <span className={label}>Usually takes, from (min)</span>
          <input name="estimatedMinutesMin" inputMode="numeric" placeholder="30" className={field} />
        </label>
        <label className="block">
          <span className={label}>to (min)</span>
          <input name="estimatedMinutesMax" inputMode="numeric" placeholder="90" className={field} />
        </label>
      </div>

      <div className="flex items-center gap-4">
        <Submit label="Add area" />
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
      </div>
    </form>
  )
}

export function ZoneToggle({
  id,
  name,
  isActive,
}: {
  id: string
  name: string
  isActive: boolean
}) {
  const [state, formAction] = useActionState<ZoneFormState, FormData>(
    setZoneActiveAction,
    {},
  )

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="isActive" value={isActive ? 'false' : 'true'} />
        <button
          type="submit"
          className="border border-rule px-3 py-1.5 font-mono text-micro uppercase tracking-label transition-colors hover:border-ink hover:bg-ink hover:text-paper"
          aria-label={`${isActive ? 'Stop' : 'Start'} delivering to ${name}`}
        >
          {isActive ? 'Stop delivering' : 'Start again'}
        </button>
      </form>
      {state.error && (
        <p role="alert" className="mt-2 max-w-xs text-small text-accent">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="mt-2 max-w-xs text-small text-support">
          {state.message}
        </p>
      )}
    </div>
  )
}
