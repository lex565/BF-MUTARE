import { currentUser } from '@/lib/auth'
import { IdleTimeout } from '@/app/components/IdleTimeout'

/**
 * Runs the idle timer, but only for someone signed in.
 *
 * A server component wrapper so the timer never reaches an anonymous
 * visitor's browser at all. A shopper who is not signed in has no session to
 * protect and should not be carrying a countdown around with them.
 */
export async function IdleGuard() {
  const user = await currentUser()
  if (!user) return null
  return <IdleTimeout />
}
