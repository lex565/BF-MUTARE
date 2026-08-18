'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { signIn, signUp, type AuthState } from '@/app/login/actions'

/**
 * Sign in / create account.
 *
 * One form, two modes, because on a phone a tab that reloads the page loses
 * whatever was already typed. Deliberately plain: email and password only.
 *
 * Google and Facebook are not here yet. Both need credentials from consoles
 * only the owner can open, and neither is worth blocking on - see the answer
 * to question 5. When those exist, two buttons go above the divider and
 * nothing else changes.
 */

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-accent px-8 py-4 font-mono text-small font-bold uppercase tracking-label text-white transition-colors duration-200 hover:bg-accent-deep disabled:opacity-60"
    >
      {pending ? 'One moment…' : label}
    </button>
  )
}

export function LoginForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const action = mode === 'in' ? signIn : signUp
  const [state, formAction] = useActionState<AuthState, FormData>(action, {})

  return (
    <div className="max-w-md">
      <div className="flex gap-6 border-b border-rule">
        {(
          [
            ['in', 'Sign in'],
            ['up', 'Create account'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            aria-pressed={mode === value}
            className={`-mb-px border-b-2 pb-3 font-mono text-micro uppercase tracking-label transition-colors ${
              mode === value
                ? 'border-accent text-ink'
                : 'border-transparent text-ink-faint hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <form action={formAction} className="mt-8 space-y-5">
        {next && <input type="hidden" name="next" value={next} />}

        {mode === 'up' && (
          <div>
            <label
              htmlFor="fullName"
              className="block font-mono text-micro uppercase tracking-label text-ink-faint"
            >
              Your name
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              /* Put back what was typed. A refused attempt re-renders the
                 form, and an uncontrolled input comes back empty. */
              defaultValue={state.typed?.fullName ?? ''}
              className="mt-2 w-full border border-rule bg-paper px-4 py-3 text-body focus:border-accent focus:outline-none"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="block font-mono text-micro uppercase tracking-label text-ink-faint"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={state.typed?.email ?? ''}
            /* inputMode/autoCapitalize matter here: most customers are on a
               phone, and a capitalised first letter breaks the address. */
            inputMode="email"
            autoCapitalize="none"
            className="mt-2 w-full border border-rule bg-paper px-4 py-3 text-body focus:border-accent focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block font-mono text-micro uppercase tracking-label text-ink-faint"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            className="mt-2 w-full border border-rule bg-paper px-4 py-3 text-body focus:border-accent focus:outline-none"
          />
          {mode === 'up' && (
            <p className="mt-2 text-small text-ink-faint">
              At least 8 characters.
            </p>
          )}
        </div>

        {state.error && (
          <p
            role="alert"
            className="border-l-4 border-accent bg-accent-wash px-4 py-3 text-small"
          >
            {state.error}
          </p>
        )}
        {state.message && (
          <p role="status" className="text-small text-support">
            {state.message}
          </p>
        )}

        <Submit label={mode === 'in' ? 'Sign in' : 'Create account'} />
      </form>

      {mode === 'in' && (
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
          <a
            href="/forgot-password"
            className="font-mono text-micro uppercase tracking-label text-support transition-colors hover:text-accent"
          >
            Forgotten your password?
          </a>
          {/* The reset email sends a code rather than a link, so there has to
              be a visible way in for somebody already holding one - they may
              have asked on a different device, or closed the tab. */}
          <a
            href="/reset-password"
            className="font-mono text-micro uppercase tracking-label text-ink-faint transition-colors hover:text-ink"
          >
            I have a reset code
          </a>
        </div>
      )}

      <p className="mt-8 max-w-[42ch] text-small text-ink-faint">
        Creating an account here makes you a customer. Staff and rider access is
        granted separately by the shop - it is not something you can pick.
      </p>
    </div>
  )
}
