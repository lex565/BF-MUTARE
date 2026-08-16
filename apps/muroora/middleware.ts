import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Session refresh, and a first gate on the private areas.
 *
 * Two jobs:
 *
 * 1. Refresh the Supabase session cookie. Server Components cannot write
 *    cookies, so without this a session would expire mid-visit and the
 *    customer would be silently logged out.
 *
 * 2. Bounce anonymous visitors away from /admin and /staff before the page
 *    renders. This is a convenience, NOT the security boundary - middleware
 *    checks the session but deliberately does not query the database for
 *    roles, because that would add a round trip to every request.
 *
 *    THE REAL CHECK IS `requireRole()` INSIDE EACH PAGE AND SERVER ACTION.
 *    A server action can be invoked directly without ever passing through
 *    this file, so anything that trusts middleware alone is open.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of toSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isPrivate =
    path.startsWith('/admin') ||
    path.startsWith('/staff') ||
    path.startsWith('/account')

  if (isPrivate && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Remember where they were going, so login can return them there rather
    // than dumping them on the homepage.
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    /**
     * Everything except static assets and images.
     *
     * The shop, product pages and cart are deliberately NOT gated - the brief
     * is explicit that customers browse and build a cart without an account.
     */
    '/((?!_next/static|_next/image|favicon.ico|logo.png|hero|.*\\.(?:svg|png|jpg|jpeg|webp|mp4)$).*)',
  ],
}
