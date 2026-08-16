'use client'

import { useEffect } from 'react'

/**
 * Forward a recovery link that landed on the wrong page.
 *
 * Password reset links carry their tokens in the URL fragment. The reset
 * request always asks Supabase to send people to /reset-password, but the
 * destination is decided by settings outside this codebase, and a link that
 * arrives anywhere else would otherwise do nothing at all: the fragment sits
 * in the address bar, no page reads it, and the customer concludes the link is
 * broken.
 *
 * So if a recovery fragment turns up on any page, carry it to the page that
 * knows what to do with it. The fragment is preserved exactly, because it is
 * the credential.
 *
 * Renders nothing, and does nothing at all on an ordinary visit.
 */
export function RecoveryRedirect() {
  useEffect(() => {
    const hash = window.location.hash
    if (!hash || !hash.includes('type=recovery')) return
    if (window.location.pathname.startsWith('/reset-password')) return

    window.location.replace(`/reset-password${hash}`)
  }, [])

  return null
}
