'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { SiteLogo } from '@/app/components/SiteLogo'
import { signIn, signUp, type AuthState } from '@/app/login/actions'

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-support px-8 py-4 font-mono text-small font-bold uppercase tracking-label text-white transition-colors hover:bg-ink disabled:opacity-60"
    >
      {pending ? 'Checking access…' : label}
    </button>
  )
}

export function AccessLoginForm({
  next,
  label,
  description,
  allowCreateAccount = false,
  managementLink = false,
}: {
  next: string
  label: string
  description: string
  allowCreateAccount?: boolean
  managementLink?: boolean
}) {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const action = mode === 'up' ? signUp : signIn
  const [state, formAction] = useActionState<AuthState, FormData>(action, {})

  return (
    <main className="flex min-h-[80vh] items-center bg-paper-sunk px-gutter py-section">
      <section className="mx-auto w-full max-w-md border border-rule bg-paper p-7 shadow-sm sm:p-10">
        <SiteLogo className="h-11" />
        <p className="mt-9 font-mono text-micro uppercase tracking-label text-accent">{label}</p>
        <h1 className="mt-3 text-h1">{mode === 'up' ? 'Create staff account' : 'Sign in'}</h1>
        <p className="mt-4 text-ink-soft">{description}</p>

        <form action={formAction} className="mt-8 space-y-5">
          <input type="hidden" name="next" value={mode === 'up' ? '/account' : next} />
          {mode === 'up' && (
            <div>
              <label htmlFor="access-name" className="block font-mono text-micro uppercase tracking-label text-ink-faint">Full name</label>
              <input id="access-name" name="fullName" type="text" required autoComplete="name" defaultValue={state.typed?.fullName ?? ''} className="mt-2 w-full border border-rule bg-paper px-4 py-3 focus:border-accent focus:outline-none" />
            </div>
          )}
          <div>
            <label htmlFor="access-email" className="block font-mono text-micro uppercase tracking-label text-ink-faint">Email</label>
            <input id="access-email" name="email" type="email" required autoComplete="email" defaultValue={state.typed?.email ?? ''} inputMode="email" autoCapitalize="none" className="mt-2 w-full border border-rule bg-paper px-4 py-3 focus:border-accent focus:outline-none" />
          </div>
          <div>
            <label htmlFor="access-password" className="block font-mono text-micro uppercase tracking-label text-ink-faint">Password</label>
            <input id="access-password" name="password" type="password" required minLength={8} autoComplete="current-password" className="mt-2 w-full border border-rule bg-paper px-4 py-3 focus:border-accent focus:outline-none" />
          </div>
          {state.error && <p role="alert" className="border-l-4 border-accent bg-accent-wash px-4 py-3 text-small">{state.error}</p>}
          <Submit label={mode === 'up' ? 'Create account' : `Enter ${label}`} />
        </form>

        {allowCreateAccount && (
          <button type="button" onClick={() => setMode((current) => current === 'in' ? 'up' : 'in')} className="mt-5 w-full text-center font-mono text-micro uppercase tracking-label text-support hover:text-accent">
            {mode === 'in' ? 'Create a staff account' : 'Already registered? Sign in'}
          </button>
        )}

        {mode === 'in' && (
          <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2">
            <Link href="/forgot-password" className="font-mono text-micro uppercase tracking-label text-support hover:text-accent">Forgotten your password?</Link>
            {/* The reset email carries a code, not a link. Somebody holding
                one needs a box to type it into from wherever they are. */}
            <Link href="/reset-password" className="font-mono text-micro uppercase tracking-label text-ink-faint hover:text-ink">I have a reset code</Link>
          </div>
        )}

        <p className="mt-7 text-small text-ink-faint">New staff accounts require admin approval before staff tools become available.</p>
        {managementLink && <Link href="/management-access" className="mt-5 block border-t border-rule pt-5 text-center font-mono text-[0.62rem] uppercase tracking-label text-ink-faint hover:text-support">Admin login</Link>}
      </section>
    </main>
  )
}
