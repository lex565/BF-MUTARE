import { cookies } from 'next/headers'

import { currentUser } from '@/lib/auth'
import { newCartToken, type CartOwner } from '@/lib/services/cart'

/**
 * Work out whose cart this request is for.
 *
 * Signed in → the user's cart. Otherwise → a cart keyed to an anonymous token
 * held in a cookie, minted on first use.
 *
 * THE COOKIE IS THE ONLY THING PROTECTING A GUEST CART, so it is httpOnly
 * (script cannot read it, which limits what an XSS bug could steal), sameSite
 * lax (not sent from another site's form post), and secure in production. The
 * token itself is 24 random bytes - long enough that guessing another
 * shopper's cart id is not a realistic attack.
 *
 * A guest cart holds no payment details and no address. It is a list of
 * groceries. The protection is proportionate to that, not to a bank session.
 */

const COOKIE = 'muroora_cart'
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60

export async function resolveCartOwner(): Promise<{
  owner: CartOwner
  /** Set when a new token was minted and must be written to the response. */
  newToken?: string
}> {
  const user = await currentUser()
  if (user) return { owner: { userId: user.id } }

  const jar = await cookies()
  const existing = jar.get(COOKIE)?.value

  if (existing) return { owner: { token: existing } }

  const token = newCartToken()
  return { owner: { token }, newToken: token }
}

/** Apply a freshly minted token to the outgoing response. */
export function setCartCookie(response: Response, token: string): Response {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  response.headers.append(
    'Set-Cookie',
    `${COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure}`,
  )
  return response
}

export const CART_COOKIE_NAME = COOKIE
