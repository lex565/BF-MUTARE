'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { submitApplication, type ApplyState } from './actions'

const KINDS = [
  ['RETAIL', 'Shop or retail'],
  ['FOOD', 'Food, takeaway or restaurant'],
  ['ACCOMMODATION', 'Accommodation or lodging'],
  ['SERVICE', 'A service (trades, tutoring, repairs)'],
  ['OTHER', 'Something else'],
] as const

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-8 w-full rounded-full bg-support px-7 py-4 font-mono text-small font-bold uppercase tracking-label text-white transition-colors hover:bg-ink disabled:opacity-60 sm:w-auto"
    >
      {pending ? 'Sending…' : 'Submit for review'}
    </button>
  )
}

/**
 * The real business application.
 *
 * Replaces a preview whose submit button raised `alert('Preview only')`. This
 * one writes to the database and the application is genuinely waiting for a
 * person to look at it.
 *
 * The honesty about what happens next matters more than the form: somebody
 * filling this in has to know their business is not live yet, or they will
 * wait for customers who cannot see them.
 */
export function ApplyForm() {
  const [state, formAction] = useActionState<ApplyState, FormData>(
    submitApplication,
    {},
  )

  const field =
    'mt-2 min-h-14 w-full rounded-2xl border border-rule bg-paper px-5 focus:border-accent focus:outline-none'
  const label = 'font-mono text-micro uppercase tracking-label text-ink-faint'

  if (state.message) {
    return (
      <div className="rounded-2xl border border-rule bg-paper p-8">
        <p className="font-mono text-micro uppercase tracking-label text-accent">
          Received
        </p>
        <h2 className="mt-3 text-h2 text-support">Thank you.</h2>
        <p className="mt-4 max-w-[55ch] text-ink-soft">{state.message}</p>
        <Link
          href="/"
          className="mt-7 inline-block rounded-full bg-support px-7 py-4 font-mono text-small font-bold uppercase tracking-label text-white"
        >
          Back to Musuwo
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="max-w-2xl">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Business name</span>
          <input name="businessName" required maxLength={120} className={field} placeholder="Your trading name" />
        </label>

        <label className="block">
          <span className={label}>What kind of business?</span>
          <select name="kind" defaultValue="RETAIL" className={field}>
            {KINDS.map(([value, text]) => (
              <option key={value} value={value}>{text}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={label}>Town or city</span>
          <input name="city" required defaultValue="Mutare" maxLength={80} className={field} />
        </label>

        <label className="block">
          <span className={label}>Phone (optional)</span>
          <input name="contactPhone" inputMode="tel" maxLength={40} className={field} placeholder="+263 77 000 0000" />
        </label>

        <label className="block sm:col-span-2">
          <span className={label}>Email (optional)</span>
          <input name="contactEmail" type="email" inputMode="email" autoCapitalize="none" className={field} placeholder="you@example.com" />
        </label>

        <label className="block sm:col-span-2">
          <span className={label}>What do you offer customers?</span>
          <textarea name="note" rows={4} maxLength={2000} className={`${field} py-4`} placeholder="A sentence or two is enough." />
        </label>
      </div>

      {/* Said plainly, because the alternative is somebody believing they are
          open for business and waiting for orders that cannot reach them. */}
      <div className="mt-7 rounded-2xl bg-accent-wash p-5">
        <strong>A person reviews this.</strong>
        <p className="mt-2 text-small text-ink-soft">
          Submitting does not list your business. No account can approve itself
          or make itself a merchant. Your contact details stay private and are
          never shown to customers without your say-so.
        </p>
      </div>

      {state.error && (
        <p role="alert" className="mt-6 border-l-4 border-accent bg-accent-wash px-4 py-3 text-small">
          {state.error}
        </p>
      )}

      <Submit />
    </form>
  )
}
