'use client'

import { signOut } from '@/app/login/actions'

/** Ends the session and returns to the public site. */
export function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="cc-signout">
        Sign out
      </button>
    </form>
  )
}
