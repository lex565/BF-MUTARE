/**
 * SERVER ONLY.
 *
 * Not enforced with the `server-only` package, deliberately. That package
 * throws the moment it is imported outside React's server condition, which
 * includes plain node - so adding it here would make this module impossible to
 * import from db/verify-*.mts, and the verify suites are how every rule on
 * this platform is proved rather than asserted.
 *
 * The guard that actually holds is structural: this module reaches @/db/client,
 * which pulls in the postgres driver, which cannot be bundled for a browser.
 * Importing it from a client component fails the build with "Can't resolve
 * 'fs'" - the same wall that keeps registration.ts out of the application form.
 * See lib/platform/provider-types.ts for the note on that.
 */
import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'

/**
 * The browsing session an event belongs to.
 *
 * WHAT THIS IS NOT
 *
 * It is not an identity. It is a rotating opaque value whose only job is to
 * let the platform say "these twelve impressions came from one person
 * scrolling" rather than "twelve people saw this". Anonymous browsing on
 * Musuwo stays anonymous: nothing here is joined to a name, an email or an
 * account, and `product_events.user_id` is null unless somebody is signed in.
 *
 * WHY IT EXPIRES IN A DAY
 *
 * Long enough that a shopping session survives closing a tab and coming back
 * after lunch. Short enough that it is not a durable tracking identifier. A
 * thirty-day session id would be a de facto profile of an anonymous person,
 * which is precisely what `recordMarketplaceProductView` was written to avoid
 * and what section 15's "do not collect unnecessary personally identifiable
 * information" is asking for.
 *
 * WHY httpOnly
 *
 * Script cannot read it, so a cross-site scripting bug cannot lift it, and
 * more importantly a merchant cannot read their own session id out of their
 * browser and post it back with forged events. The client never sees the value
 * at all: it is attached to the request by the browser, and only the server
 * ever knows what it says.
 */

const COOKIE = 'musuwo_discovery'
const MAX_AGE_SECONDS = 24 * 60 * 60

export function newSessionId(): string {
  return randomBytes(18).toString('base64url')
}

/**
 * Read the current session id, or mint one.
 *
 * Returns the value plus whether it is new, because a Server Component cannot
 * write cookies - the caller has to attach it to a response. Callers that
 * cannot set a cookie still get a usable id; it simply will not persist, which
 * degrades deduplication rather than breaking anything.
 */
export async function discoverySession(): Promise<{
  sessionId: string
  isNew: boolean
}> {
  const jar = await cookies()
  const existing = jar.get(COOKIE)?.value
  if (existing) return { sessionId: existing, isNew: false }
  return { sessionId: newSessionId(), isNew: true }
}

export function setDiscoveryCookie(response: Response, sessionId: string): Response {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  response.headers.append(
    'Set-Cookie',
    `${COOKIE}=${sessionId}; Path=/; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure}`,
  )
  return response
}

export const DISCOVERY_COOKIE_NAME = COOKIE
