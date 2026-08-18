'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  submitFeedbackAction,
  type FeedbackState,
} from '@/app/beta/actions'

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-support px-8 py-4 font-mono text-small font-bold uppercase tracking-label text-white transition-colors hover:bg-ink disabled:opacity-60"
    >
      {pending ? 'Sending…' : 'Send it'}
    </button>
  )
}

/**
 * Beta feedback.
 *
 * The kind matters: choosing "Security problem" routes the report away from
 * the shared list, because an unfixed security report is a working exploit
 * written down. The form says so, so somebody sitting on a finding knows there
 * is a safe way to hand it over.
 */
export function BetaFeedbackForm({
  signedInAs,
  currentVersion,
}: {
  signedInAs: string | null
  currentVersion: string | null
}) {
  const [state, act] = useActionState<FeedbackState, FormData>(
    submitFeedbackAction,
    {},
  )
  const [kind, setKind] = useState('BUG')

  const field =
    'mt-2 w-full border border-rule bg-paper px-4 py-3 focus:border-accent focus:outline-none'
  const label =
    'block font-mono text-micro uppercase tracking-label text-ink-faint'

  if (state.message) {
    return (
      <p role="status" className="mt-6 border-l-4 border-support bg-paper-sunk px-5 py-5">
        {state.message}
      </p>
    )
  }

  return (
    <form action={act} className="mt-6 space-y-5">
      <div>
        <span className={label}>What kind of thing is it?</span>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ['BUG', 'Something is broken'],
            ['CRASH', 'The app closed itself'],
            ['SUGGESTION', 'An idea'],
            ['SECURITY', 'Security problem'],
          ].map(([value, text]) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value)}
              aria-pressed={kind === value}
              className={`chip transition-colors ${
                kind === value ? 'border-support bg-support text-white' : ''
              }`}
            >
              {text}
            </button>
          ))}
        </div>
        <input type="hidden" name="kind" value={kind} />
      </div>

      {kind === 'SECURITY' && (
        <p className="border-l-4 border-accent bg-accent-wash px-5 py-4 text-small">
          This goes to a private list. It will not appear anywhere other
          testers or ordinary administrators can read it. Please do not post
          security findings in a group chat.
        </p>
      )}

      <div>
        <label htmlFor="fb-message" className={label}>
          What happened?
        </label>
        <textarea
          id="fb-message"
          name="message"
          required
          minLength={10}
          rows={5}
          className={field}
          placeholder="What were you doing, and what did the app do?"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="fb-version" className={label}>
            App version
          </label>
          <input
            id="fb-version"
            name="appVersion"
            defaultValue={currentVersion ?? ''}
            className={field}
            placeholder="0.2.0"
          />
        </div>
        <div>
          <label htmlFor="fb-device" className={label}>
            Phone
          </label>
          <input
            id="fb-device"
            name="device"
            className={field}
            placeholder="Samsung A14, Android 14"
          />
        </div>
      </div>

      <div>
        <label htmlFor="fb-contact" className={label}>
          How we reach you {signedInAs ? '(optional)' : ''}
        </label>
        <input
          id="fb-contact"
          name="contact"
          className={field}
          defaultValue={signedInAs ?? ''}
          placeholder="Phone or email, if you want an answer"
        />
        {signedInAs && (
          <p className="mt-2 text-small text-ink-faint">
            You are signed in as {signedInAs}, so we already know who this is
            from.
          </p>
        )}
      </div>

      {state.error && (
        <p role="alert" className="border-l-4 border-accent bg-accent-wash px-4 py-3 text-small">
          {state.error}
        </p>
      )}

      <Submit />
    </form>
  )
}
