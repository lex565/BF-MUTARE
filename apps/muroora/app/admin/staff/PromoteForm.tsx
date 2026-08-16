'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  promoteAction,
  searchAccountsAction,
  type StaffFormState,
} from '@/app/admin/staff/actions'

/**
 * Find an existing account and give it staff access.
 *
 * Deliberately two steps: search, then choose. There is no "create a staff
 * account" form here, and that is the point of §7 — the employee signs up
 * themselves with their own password, which nobody else ever knows, and an
 * admin only decides what that account is allowed to do.
 */

const ROLE_LABELS: Record<string, { label: string; blurb: string }> = {
  SHOP_STAFF: {
    label: 'Shop staff',
    blurb: 'Sees orders, picks and packs them, adjusts stock.',
  },
  ADMIN: {
    label: 'Admin',
    blurb: 'Everything shop staff can do, plus prices, products and people.',
  },
  RIDER: {
    label: 'Rider',
    blurb: 'Delivery only. Sees the drops assigned to them, nothing else.',
  },
  VIEWER: {
    label: 'Oversight (view only)',
    blurb:
      'Sees every screen and every number. Cannot change anything at all. ' +
      'Does not count towards the three admin places.',
  },
}

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

export function PromoteForm() {
  /**
   * Controlled, so the search term survives the round trip. An uncontrolled
   * input empties itself when the action returns, which then trips the
   * `required` rule and paints the box red immediately after a search that
   * worked — the box looks like an error at the exact moment it succeeded.
   */
  const [query, setQuery] = useState('')

  const [search, searchFormAction] = useActionState<StaffFormState, FormData>(
    searchAccountsAction,
    {},
  )
  const [promote, promoteFormAction] = useActionState<StaffFormState, FormData>(
    promoteAction,
    {},
  )

  return (
    <div className="mt-6 max-w-4xl">
      <form action={searchFormAction} className="flex flex-wrap gap-3">
        <input
          name="query"
          required
          minLength={3}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Their email, name or phone number"
          aria-label="Find an account"
          className="min-w-[20rem] flex-1 border border-rule bg-paper px-3 py-2 focus:border-accent focus:outline-none"
        />
        <Submit label="Find" />
      </form>

      {search.error && (
        <p role="alert" className="mt-3 text-small text-accent">
          {search.error}
        </p>
      )}
      {search.message && (
        <p role="status" className="mt-3 text-small text-ink-soft">
          {search.message}
        </p>
      )}

      {search.results && search.results.length > 0 && (
        <ul className="mt-6 divide-y divide-rule border-y border-rule">
          {search.results.map((person) => {
            const already = person.roles.filter((r) => r !== 'CUSTOMER')
            return (
              <li key={person.userId} className="py-5">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-bold">
                    {person.fullName ?? 'No name given'}
                  </span>
                  <span className="font-mono text-small text-ink-faint">
                    {person.email ?? person.phone ?? '—'}
                  </span>
                  {person.staffNumber && (
                    <span className="font-mono text-micro uppercase tracking-label text-support">
                      {person.staffNumber}
                      {person.status !== 'ACTIVE' && ` · ${person.status}`}
                    </span>
                  )}
                </div>

                <p className="mt-1 text-small text-ink-faint">
                  {already.length > 0
                    ? `Already has: ${already.join(', ')}`
                    : 'Customer account only — no staff access.'}
                </p>

                <form
                  action={promoteFormAction}
                  className="mt-4 flex flex-wrap items-end gap-3"
                >
                  <input
                    type="hidden"
                    name="userId"
                    value={person.userId}
                  />

                  <label className="block">
                    <span className="block font-mono text-micro uppercase tracking-label text-ink-faint">
                      Give them
                    </span>
                    <select
                      name="role"
                      defaultValue="SHOP_STAFF"
                      className="mt-1 border border-rule bg-paper px-3 py-2 text-small focus:border-accent focus:outline-none"
                    >
                      {Object.entries(ROLE_LABELS).map(([value, meta]) => (
                        <option key={value} value={value}>
                          {meta.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="block font-mono text-micro uppercase tracking-label text-ink-faint">
                      Job title (optional)
                    </span>
                    <input
                      name="jobTitle"
                      placeholder="e.g. Shop assistant"
                      className="mt-1 border border-rule bg-paper px-3 py-2 text-small focus:border-accent focus:outline-none"
                    />
                  </label>

                  <Submit label="Grant" />
                </form>
              </li>
            )
          })}
        </ul>
      )}

      {promote.error && (
        <p role="alert" className="mt-4 text-small text-accent">
          {promote.error}
        </p>
      )}
      {promote.message && (
        <p role="status" className="mt-4 text-small text-support">
          {promote.message} Refresh to see them in the list below.
        </p>
      )}

    </div>
  )
}
