'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { verifyAction, type VerifyState } from '@/app/super-admin/businesses/actions'

function Submit({ label, className }: { label: string; className: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? 'Saving…' : label}
    </button>
  )
}

/**
 * Record that a licence has been seen.
 *
 * The copy says what the badge means, on the screen where somebody decides to
 * grant it. A reviewer who thinks "verified" means "good" will apply it to the
 * businesses they like, which is exactly how the badge stops being worth
 * anything to a customer.
 */
export function VerifyPanel({
  businessId,
  name,
  licenceNumber,
  verified,
}: {
  businessId: string
  name: string
  licenceNumber: string | null
  verified: boolean
}) {
  const [state, act] = useActionState<VerifyState, FormData>(verifyAction, {})
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button type="button" className="cc-btn cc-btn-quiet" onClick={() => setOpen(true)}>
        {verified ? 'Change' : 'Verify'}
      </button>
    )
  }

  return (
    <div style={{ minWidth: '18rem' }}>
      {state.error && <p className="cc-note cc-error" role="alert">{state.error}</p>}
      {state.message && <p className="cc-note" role="status">{state.message}</p>}

      <p style={{ margin: '0 0 .75rem', fontSize: '.85rem', color: 'var(--cc-ink-soft)' }}>
        Only tick this off once you have actually seen {name}&rsquo;s trading
        licence or registration certificate. The badge tells customers the
        business is registered and traceable. It does not say they are good, and
        it should never be given for being good.
      </p>

      <form action={act}>
        <input type="hidden" name="businessId" value={businessId} />
        <label className="cc-field">
          <span className="cc-label">Licence or registration number</span>
          <input
            name="licenceNumber"
            className="cc-input"
            required
            defaultValue={licenceNumber ?? ''}
            placeholder="As printed on the document"
          />
        </label>
        <div className="cc-actions" style={{ marginTop: 0 }}>
          <Submit label="I have seen it" className="cc-btn cc-btn-go" />
          <button type="button" className="cc-btn cc-btn-quiet" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </form>

      {verified && (
        <form action={act} style={{ marginTop: '1rem' }}>
          <input type="hidden" name="businessId" value={businessId} />
          <input type="hidden" name="withdraw" value="1" />
          <label className="cc-field">
            <span className="cc-label">Withdraw — why?</span>
            <input name="reason" className="cc-input" />
          </label>
          <Submit label="Withdraw verification" className="cc-btn cc-btn-stop" />
        </form>
      )}
    </div>
  )
}
