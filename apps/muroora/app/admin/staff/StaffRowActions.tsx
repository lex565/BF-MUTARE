'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  revokeAction,
  setStatusAction,
  type StaffFormState,
} from '@/app/admin/staff/actions'

/**
 * Per-person controls on the staff list.
 *
 * Suspending or marking someone as left removes their access at the same time,
 * so an admin does not have to remember two steps. That is the whole reason
 * this is one control rather than two - the gap between "he doesn't work here
 * any more" and "his login still opens the till screen" is where trouble
 * lives.
 */

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-rule px-3 py-1.5 font-mono text-micro uppercase tracking-label transition-colors hover:border-ink hover:bg-ink hover:text-paper disabled:opacity-50"
    >
      {pending ? '…' : label}
    </button>
  )
}

export function StaffRowActions({
  userId,
  name,
  status,
  roles,
}: {
  userId: string
  name: string
  status: 'ACTIVE' | 'SUSPENDED' | 'LEFT' | null
  roles: string[]
}) {
  const [state, formAction] = useActionState<StaffFormState, FormData>(
    setStatusAction,
    {},
  )
  const [revokeState, revokeFormAction] = useActionState<
    StaffFormState,
    FormData
  >(revokeAction, {})

  const grantable = roles.filter((r) => r !== 'CUSTOMER')

  return (
    <div className="space-y-3">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="userId" value={userId} />
        <select
          name="status"
          defaultValue={status ?? 'ACTIVE'}
          aria-label={`Employment status for ${name}`}
          className="border border-rule bg-paper px-2 py-1.5 text-small focus:border-accent focus:outline-none"
        >
          <option value="ACTIVE">Working</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="LEFT">Left</option>
        </select>
        <Submit label="Set" />
      </form>

      {grantable.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {grantable.map((role) => (
            <form key={role} action={revokeFormAction}>
              <input type="hidden" name="userId" value={userId} />
              <input type="hidden" name="role" value={role} />
              <Submit label={`Remove ${role.replace('_', ' ')}`} />
            </form>
          ))}
        </div>
      )}

      {(state.error ?? revokeState.error) && (
        <p role="alert" className="max-w-xs text-small text-accent">
          {state.error ?? revokeState.error}
        </p>
      )}
      {(state.message ?? revokeState.message) && (
        <p role="status" className="max-w-xs text-small text-support">
          {state.message ?? revokeState.message}
        </p>
      )}
    </div>
  )
}
