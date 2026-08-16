'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Logo } from '@/app/components/Logo'
import { requestPasswordReset, type AuthState } from '@/app/login/actions'

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-support px-8 py-4 font-mono text-small font-bold uppercase tracking-label text-white transition-colors hover:bg-ink disabled:opacity-60"
    >
      {pending ? 'Sending…' : 'Send me a link'}
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
        <Logo className="h-11" />
        <p className="mt-9 font-mono text-micro uppercase tracking-label text-accent">
          Password
        </p>
        <h1 className="mt-3 text-h1">Forgotten it?</h1>
        <p className="mt-4 text-ink-soft">
          Put in the email address you signed up with and we will send you a
          link to set a new password.
        </p>

        {expired && (
          <p
            role="status"
            className="mt-6 border-l-4 border-accent bg-accent-wash px-4 py-3 text-small"
          >
            That link had already been used, or it was more than an hour old.
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
            <p
              role="status"
              className="border-l-4 border-support bg-paper-sunk px-4 py-3 text-small"
            >
              {state.message}
            </p>
          )}

          <Submit />
        </form>

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
