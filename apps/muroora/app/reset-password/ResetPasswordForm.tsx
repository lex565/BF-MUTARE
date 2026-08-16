'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Logo } from '@/app/components/Logo'
import { completePasswordReset, type AuthState } from '@/app/login/actions'

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-support px-8 py-4 font-mono text-small font-bold uppercase tracking-label text-white transition-colors hover:bg-ink disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save new password'}
    </button>
  )
}

export function ResetPasswordForm({
  ready,
  problem,
}: {
  ready: boolean
  problem: string | null
}) {
  const [state, formAction] = useActionState<AuthState, FormData>(
    completePasswordReset,
    {},
  )

  return (
    <main className="flex min-h-[80vh] items-center bg-paper-sunk px-gutter py-section">
      <section className="mx-auto w-full max-w-md border border-rule bg-paper p-7 shadow-sm sm:p-10">
        <Logo className="h-11" />
        <p className="mt-9 font-mono text-micro uppercase tracking-label text-accent">
          Password
        </p>
        <h1 className="mt-3 text-h1">Set a new one</h1>

        {!ready ? (
          <>
            <p
              role="alert"
              className="mt-6 border-l-4 border-accent bg-accent-wash px-4 py-3 text-small"
            >
              {problem}
            </p>
            <Link
              href="/forgot-password"
              className="mt-7 block w-full bg-support px-8 py-4 text-center font-mono text-small font-bold uppercase tracking-label text-white transition-colors hover:bg-ink"
            >
              Ask for a new link
            </Link>
          </>
        ) : (
          <form action={formAction} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="new-password"
                className="block font-mono text-micro uppercase tracking-label text-ink-faint"
              >
                New password
              </label>
              <input
                id="new-password"
                name="password"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                className="mt-2 w-full border border-rule bg-paper px-4 py-3 focus:border-accent focus:outline-none"
              />
              <p className="mt-2 text-small text-ink-faint">
                At least 10 characters. Three ordinary words you will remember
                beat one short word with symbols in it.
              </p>
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="block font-mono text-micro uppercase tracking-label text-ink-faint"
              >
                Type it again
              </label>
              <input
                id="confirm-password"
                name="confirm"
                type="password"
                required
                autoComplete="new-password"
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

            <Submit />
          </form>
        )}
      </section>
    </main>
  )
}
