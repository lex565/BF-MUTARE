import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

import { supabaseServer } from '@/lib/supabase/server'

/**
 * Where every emailed auth link lands.
 *
 * WHY THIS EXISTS. The reset page used to call `exchangeCodeForSession`, which
 * is the PKCE flow, and PKCE needs a `code_verifier` cookie written into the
 * SAME browser that asked for the reset. Ask for the link on a laptop, open
 * the email on your phone, and that cookie does not exist, so the exchange
 * fails and the page says the link has expired. It had not expired. It could
 * never have worked.
 *
 * `verifyOtp` with a token hash carries everything in the link itself, so it
 * works from any device, which is how people actually read email.
 *
 * The token is one-time. Mail scanners that fetch links before the recipient
 * sees them will burn it, and the honest answer then is to ask for another.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const tokenHash = params.get('token_hash')
  const type = params.get('type') as EmailOtpType | null
  const next = params.get('next') ?? '/account'

  // Never redirect off-site on somebody else's say-so. An emailed link that
  // can bounce a signed-in user anywhere is a phishing tool.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/account'

  if (!tokenHash || !type) {
    redirect('/forgot-password?bad=1')
  }

  const supabase = await supabaseServer()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

  if (error) {
    redirect(`/forgot-password?expired=1`)
  }

  redirect(safeNext)
}
