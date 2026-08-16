import type { Metadata } from 'next'
import type { EmailOtpType } from '@supabase/supabase-js'

import { supabaseServer } from '@/lib/supabase/server'
import { ResetPasswordForm } from '@/app/reset-password/ResetPasswordForm'

export const metadata: Metadata = {
  title: 'Set a new password',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * Where the emailed link lands.
 *
 * Three ways in, because Supabase can arrive in three shapes depending on how
 * the template is written and which flow the project is on:
 *
 *   token_hash  the one we ask for. Works from any device.
 *   code        the PKCE flow. Only works in the browser that asked for the
 *               reset, because it needs a code_verifier cookie. This is what
 *               used to be the only path, and it is why the page insisted
 *               every link had expired when opened on a phone.
 *   neither     already mid-reset and refreshed the page, so the recovery
 *               session is already established.
 *
 * All three are handled rather than only the current one, because the email
 * template is configured outside this repo and can be changed by somebody who
 * has no reason to know what this page expects.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{
    code?: string
    token_hash?: string
    type?: string
    error_description?: string
  }>
}) {
  const { code, token_hash, type, error_description } = await searchParams

  let ready = false
  let problem = error_description ?? null

  const supabase = await supabaseServer()

  if (token_hash) {
    const { error } = await supabase.auth.verifyOtp({
      type: (type as EmailOtpType) ?? 'recovery',
      token_hash,
    })
    if (error) problem = 'That link has expired or has already been used.'
    else ready = true
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      problem =
        'That link could not be opened on this device. Ask for a new one and ' +
        'open it on the same phone or computer you asked from.'
    } else {
      ready = true
    }
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    ready = Boolean(user)
    if (!ready && !problem) {
      problem = 'Open this page from the link in your email.'
    }
  }

  return <ResetPasswordForm ready={ready} problem={problem} />
}
