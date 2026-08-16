'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Logo } from '@/app/components/Logo'
import { supabaseBrowser } from '@/lib/supabase/client'

/**
 * Set a new password from an emailed link.
 *
 * THIS HAS TO RUN IN THE BROWSER, and that is the whole story of the bug it
 * fixes.
 *
 * Supabase's verify endpoint answers a recovery link with a 303 to:
 *
 *   /reset-password#access_token=...&refresh_token=...&type=recovery
 *
 * Everything after the # is a URL FRAGMENT, and a fragment is never sent to
 * the server. It exists only in the browser. So the server component saw a
 * bare /reset-password with no code, no token and no session, and said the
 * link had expired. Nothing had expired; the server was structurally incapable
 * of seeing the credentials, so it failed every single time, instantly, on
 * every device.
 *
 * Reading the fragment here and calling setSession is the fix. It needs no
 * cookie from an earlier request, so it works when the link is opened on a
 * different phone from the one that asked, which is the normal case.
 */
export function ResetPasswordForm({
  ready: serverReady,
  problem: serverProblem,
}: {
  ready: boolean
  problem: string | null
}) {
  const [ready, setReady] = useState(serverReady)
  const [problem, setProblem] = useState<string | null>(serverProblem)
  const [checking, setChecking] = useState(!serverReady)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

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
      } else if (!problem) {
        setProblem('Open this page from the link in your email.')
      }
      setChecking(false)
    }

    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const supabase = supabaseBrowser()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }
    setDone(true)
  }

  return (
    <main className="flex min-h-[80vh] items-center bg-paper-sunk px-gutter py-section">
      <section className="mx-auto w-full max-w-md border border-rule bg-paper p-7 shadow-sm sm:p-10">
        <Logo className="h-11" />
        <p className="mt-9 font-mono text-micro uppercase tracking-label text-accent">
          Password
        </p>
        <h1 className="mt-3 text-h1">
          {done ? 'All set' : 'Set a new one'}
        </h1>

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
          <p className="mt-6 text-ink-soft">Checking your link…</p>
        ) : !ready ? (
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
          <form onSubmit={submit} className="mt-8 space-y-5">
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
        )}
      </section>
    </main>
  )
}
