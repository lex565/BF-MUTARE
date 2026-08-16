import type { Metadata } from 'next'

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
 * Supabase sends a one-time `code`; exchanging it establishes a short-lived
 * recovery session, and only then may a new password be set. The exchange
 * happens here, server-side, so the code never sits in client JavaScript.
 *
 * A link that has expired or already been used produces no session, and the
 * form says so rather than failing silently at the point of submission.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error_description?: string }>
}) {
  const { code, error_description } = await searchParams

  let ready = false
  let problem = error_description ?? null

  if (code) {
    const supabase = await supabaseServer()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) problem = 'That link has expired or has already been used.'
    else ready = true
  } else {
    // Somebody already mid-reset who refreshed the page still has the session.
    const supabase = await supabaseServer()
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
