'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { SiteLogo } from '@/app/components/SiteLogo'
import { brand } from '@/lib/brand'
import { requestPasswordReset, type AuthState } from '@/app/login/actions'

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-support px-8 py-4 font-mono text-small font-bold uppercase tracking-label text-white transition-colors hover:bg-ink disabled:opacity-60"
    >
      {pending ? 'Sending…' : 'Send me a code'}
    </button>
  )
}

export function ForgotPasswordForm({
  expired = false,
}: {
  expired?: boolean
}) {
  const [state, formAction] = useActionState<AuthState, FormData>(
    requestPasswordReset,
    {},
  )

  return (
    <main className="flex min-h-[80vh] items-center bg-paper-sunk px-gutter py-section">
      <section className="mx-auto w-full max-w-md border border-rule bg-paper p-7 shadow-sm sm:p-10">
        <SiteLogo className="h-11" />
        <p className="mt-9 font-mono text-micro uppercase tracking-label text-accent">
          Password
        </p>
        <h1 className="mt-3 text-h1">Forgotten it?</h1>
        <p className="mt-4 text-ink-soft">
          Put in the email address you signed up with and we will send you an
          eight-digit code to set a new {brand.name} password.
        </p>

        {expired && (
          <p
            role="status"
            className="mt-6 border-l-4 border-accent bg-accent-wash px-4 py-3 text-small"
          >
            That code had already been used, or it was more than an hour old.
            Ask for another below and it will work.
          </p>
        )}

        <form action={formAction} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="reset-email"
              className="block font-mono text-micro uppercase tracking-label text-ink-faint"
            >
              Email
            </label>
            <input
              id="reset-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              className="mt-2 w-full border border-rule bg-paper px-4 py-3 focus:border-accent focus:outline-none"
            />
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
            <div
              role="status"
              className="border-l-4 border-support bg-paper-sunk px-4 py-3 text-small"
            >
              <p>{state.message}</p>
              {/* The code has to be typed somewhere. Without this the person
                  is left holding six digits and no way back in. */}
              <Link
                href="/reset-password"
                className="mt-3 inline-block font-mono text-micro uppercase tracking-label text-support hover:text-accent"
              >
                Enter my code
              </Link>
            </div>
          )}

          <Submit />
        </form>

        {/* Always here, not only after a code has just been sent. Somebody
            who closed the tab, or asked from a laptop and is finishing on a
            phone, arrives at this page holding a code with nowhere to put it. */}
        <Link
          href="/reset-password"
          className="mt-6 block w-full border border-rule bg-paper-sunk px-6 py-3.5 text-center font-mono text-micro uppercase tracking-label text-support transition-colors hover:border-accent hover:text-accent"
        >
          I already have a code
        </Link>

        <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 border-t border-rule pt-6">
          <Link
            href="/login"
            className="font-mono text-micro uppercase tracking-label text-support hover:text-accent"
          >
            Back to sign in
          </Link>
          <Link
            href="/team-access"
            className="font-mono text-micro uppercase tracking-label text-ink-faint hover:text-ink-soft"
          >
            Staff sign in
          </Link>
        </div>
      </section>
    </main>
  )
}
