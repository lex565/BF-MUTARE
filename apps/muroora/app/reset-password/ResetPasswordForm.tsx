'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Logo } from '@/app/components/Logo'
import { resetPasswordWithCode, type AuthState } from '@/app/login/actions'
import { supabaseBrowser } from '@/lib/supabase/client'

/**
 * Set a new password.
 *
 * TWO WAYS IN, and the first one is the one that matters now.
 *
 *   AN EIGHT-DIGIT CODE, typed in below. This is what the email sends today.
 *     Eight because the project sets `mailer_otp_length` to 8; do not assume
 *     the Supabase default of 6.
 *     Gmail scans links in incoming mail and the scan OPENS them, which spent
 *     the single-use recovery token before the person ever saw the message.
 *     A scanner cannot type a code into a form, so the code cannot be burned
 *     the same way. It also works across devices, since verifying needs only
 *     the address and the digits.
 *
 *   A LINK, which puts tokens in the URL fragment. No longer sent, but kept
 *     working because an email posted before the change is valid for an hour
 *     and somebody may be holding one right now.
 *
 * The fragment matters: everything after # is never sent to the server, so a
 * server component sees a bare /reset-password and concludes the link has
 * expired when nothing has. That has to be read here, in the browser.
 */

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
  ready: serverReady,
  problem: serverProblem,
  email: initialEmail = '',
}: {
  ready: boolean
  problem: string | null
  email?: string
}) {
  const [ready, setReady] = useState(serverReady)
  const [problem, setProblem] = useState<string | null>(serverProblem)
  const [checking, setChecking] = useState(!serverReady)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const [codeState, codeAction] = useActionState<AuthState, FormData>(
    resetPasswordWithCode,
    {},
  )

  useEffect(() => {
    if (serverReady) return

    const run = async () => {
      const supabase = supabaseBrowser()

      const hash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : ''
      const params = new URLSearchParams(hash)

      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      const hashError = params.get('error_description')

      if (hashError) {
        setProblem(decodeURIComponent(hashError.replace(/\+/g, ' ')))
        setChecking(false)
        return
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        // Clear the tokens out of the address bar so they are not left in
        // history, or copied into a message when somebody shares the page.
        window.history.replaceState(null, '', window.location.pathname)

        if (error) {
          setProblem('That link has expired or has already been used.')
        } else {
          setReady(true)
          setProblem(null)
        }
        setChecking(false)
        return
      }

      // No fragment. Perhaps a session is already established, from the
      // token-hash route or from a refresh mid-reset.
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        setReady(true)
        setProblem(null)
      }
      // No else. Arriving with nothing is now the NORMAL case, because the
      // email sends a code rather than a link. The code form below is the
      // answer, so saying "open this from your email" would be wrong and
      // would send people back to an inbox they have already read.
      setChecking(false)
    }

    void run()
  }, [serverReady])

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') ?? '')
    const confirm = String(form.get('confirm') ?? '')

    if (password.length < 10) {
      setError('Use at least 10 characters - length beats punctuation.')
      return
    }
    if (password !== confirm) {
      setError('Those two do not match.')
      return
    }

    setSaving(true)
    try {
      const supabase = supabaseBrowser()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        return
      }
      setDone(true)
    } catch {
      // supabase-js throws "Auth session missing!" rather than returning it
      // when the recovery session has lapsed between opening the link and
      // submitting the form. Say what to do instead of showing the raw text.
      setError(
        'That link is no longer valid. Ask for a new one and open it straight away.',
      )
    } finally {
      setSaving(false)
    }
  }

  const fieldClass =
    'mt-2 w-full border border-rule bg-paper px-4 py-3 focus:border-accent focus:outline-none'
  const labelClass =
    'block font-mono text-micro uppercase tracking-label text-ink-faint'

  return (
    <main className="flex min-h-[80vh] items-center bg-paper-sunk px-gutter py-section">
      <section className="mx-auto w-full max-w-md border border-rule bg-paper p-7 shadow-sm sm:p-10">
        <Logo className="h-11" />
        <p className="mt-9 font-mono text-micro uppercase tracking-label text-accent">
          Password
        </p>
        <h1 className="mt-3 text-h1">{done ? 'All set' : 'Set a new one'}</h1>

        {done ? (
          <>
            <p className="mt-4 text-ink-soft">
              Your password has been changed. Use it the next time you sign in.
            </p>
            <Link
              href="/login"
              className="mt-7 block w-full bg-support px-8 py-4 text-center font-mono text-small font-bold uppercase tracking-label text-white transition-colors hover:bg-ink"
            >
              Sign in
            </Link>
          </>
        ) : checking ? (
          <p className="mt-6 text-ink-soft">One moment…</p>
        ) : ready ? (
          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="new-password" className={labelClass}>
                New password
              </label>
              <input
                id="new-password"
                name="password"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                className={fieldClass}
              />
              <p className="mt-2 text-small text-ink-faint">
                At least 10 characters. Three ordinary words you will remember
                beat one short word with symbols in it.
              </p>
            </div>

            <div>
              <label htmlFor="confirm-password" className={labelClass}>
                Type it again
              </label>
              <input
                id="confirm-password"
                name="confirm"
                type="password"
                required
                autoComplete="new-password"
                className={fieldClass}
              />
            </div>

            {error && (
              <p
                role="alert"
                className="border-l-4 border-accent bg-accent-wash px-4 py-3 text-small"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-support px-8 py-4 font-mono text-small font-bold uppercase tracking-label text-white transition-colors hover:bg-ink disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save new password'}
            </button>
          </form>
        ) : (
          <>
            <p className="mt-4 text-ink-soft">
              Check your email for an eight-digit code, then put it in below
              along with the password you want.
            </p>

            {problem && (
              <p
                role="alert"
                className="mt-6 border-l-4 border-accent bg-accent-wash px-4 py-3 text-small"
              >
                {problem}
              </p>
            )}

            <form action={codeAction} className="mt-8 space-y-5">
              <div>
                <label htmlFor="reset-email" className={labelClass}>
                  Email
                </label>
                <input
                  id="reset-email"
                  name="email"
                  type="email"
                  required
                  defaultValue={initialEmail}
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="reset-code" className={labelClass}>
                  Eight-digit code
                </label>
                <input
                  id="reset-code"
                  name="code"
                  type="text"
                  required
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  // Nine, not eight: the server strips spaces, so somebody
                  // pasting "1234 5678" out of the email must be able to.
                  maxLength={9}
                  placeholder="00000000"
                  className={`${fieldClass} font-mono text-h3 tracking-[0.3em]`}
                />
                <p className="mt-2 text-small text-ink-faint">
                  It lasts one hour and works only once. We will never ask you
                  for it any other way.
                </p>
              </div>

              <div>
                <label htmlFor="code-password" className={labelClass}>
                  New password
                </label>
                <input
                  id="code-password"
                  name="password"
                  type="password"
                  required
                  minLength={10}
                  autoComplete="new-password"
                  className={fieldClass}
                />
                <p className="mt-2 text-small text-ink-faint">
                  At least 10 characters. Three ordinary words you will remember
                  beat one short word with symbols in it.
                </p>
              </div>

              <div>
                <label htmlFor="code-confirm" className={labelClass}>
                  Type it again
                </label>
                <input
                  id="code-confirm"
                  name="confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  className={fieldClass}
                />
              </div>

              {codeState.error && (
                <p
                  role="alert"
                  className="border-l-4 border-accent bg-accent-wash px-4 py-3 text-small"
                >
                  {codeState.error}
                </p>
              )}

              <Submit />
            </form>

            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 border-t border-rule pt-6">
              <Link
                href="/forgot-password"
                className="font-mono text-micro uppercase tracking-label text-support hover:text-accent"
              >
                Send another code
              </Link>
              <Link
                href="/login"
                className="font-mono text-micro uppercase tracking-label text-ink-faint hover:text-ink-soft"
              >
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
