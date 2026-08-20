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
/**
 * Routes that belong to Musuwo and have no business on Muroora Mart's website.
 *
 * The page components redirect too, but a `redirect()` inside a server
 * component is answered by Next with a 200 and a client-side navigation - so
 * the visitor briefly receives a document whose <title> reads "Businesses on
 * Musuwo - Muroora Mart", which is precisely the mixing of the two brands this
 * is meant to prevent. Doing it here means a real 307 from the edge and no
 * renderer involved.
 *
 * The page-level redirects stay as the backstop. Middleware does not run on
 * every path shape forever, and a rule that exists in one place only is a rule
 * that quietly stops applying.
 */
const MUSUWO_ONLY = ['/marketplace', '/riders']

/** Where the marketplace lives, for a Muroora deployment sending people to it. */
const MUSUWO_ORIGIN =
  process.env.NEXT_PUBLIC_MUSUWO_URL ?? 'https://musuwo.vercel.app'

/**
 * The old product address, moved here for the reason above.
 *
 * `/marketplace/product/{merchant}/{product}` is now
 * `/stores/{merchant}/product/{product}` - see lib/musuwo-urls.ts. The legacy
 * page calls `permanentRedirect`, and that was verified against production
 * doing exactly what the note above predicts: HTTP 200, a generic
 * "Musuwo - local businesses" title, and a NEXT_REDIRECT instruction buried in
 * the RSC payload for the browser to act on.
 *
 * A browser follows it. A WhatsApp link preview, a search crawler and anything
 * else that reads the document without running React does not - so the exact
 * audience for a shared product link got a blank generic page. Doing it at the
 * edge produces a real 308 with a Location header, before any renderer.
 *
 * The page-level redirect stays as the backstop, same rule as MUSUWO_ONLY.
 */
const LEGACY_PRODUCT = /^\/marketplace\/product\/([^/]+)\/([^/]+)\/?$/

export async function middleware(request: NextRequest) {
  const brandIsMuroora = process.env.NEXT_PUBLIC_SITE_BRAND === 'muroora'
  const pathname = request.nextUrl.pathname

  const legacy = LEGACY_PRODUCT.exec(pathname)
  if (legacy) {
    const to = `/stores/${legacy[1]}/product/${legacy[2]}`
    // On the Muroora deployment this lands on Musuwo, not on Muroora. The old
    // path lived under /marketplace, which is Musuwo's, and a marketplace
    // product belongs to the marketplace: resolving it here would put Muroora
    // Mart's name above another merchant's stock.
    const url = brandIsMuroora
      ? new URL(to, MUSUWO_ORIGIN)
      : Object.assign(request.nextUrl.clone(), { pathname: to })
    // 308 rather than 307: this move is permanent, and a permanent redirect is
    // what moves a search engine's index across instead of leaving two entries
    // for one product.
    return NextResponse.redirect(url, 308)
  }

  if (
    brandIsMuroora &&
    MUSUWO_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    // /marketplace/apply goes with it: applying to join Musuwo is a Musuwo
    // errand, and the form names Musuwo throughout.
    return NextResponse.redirect(
      new URL(pathname + request.nextUrl.search, MUSUWO_ORIGIN),
    )
  }

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

  const path = pathname
  const isPrivate =
    path.startsWith('/admin') ||
    path.startsWith('/staff') ||
    path.startsWith('/account') ||
    /**
     * The Musuwo Control Center.
     *
     * Added after checking the live site: without it, an anonymous request to
     * /super-admin returned 200 and the public shell, then redirected in the
     * browser. No Control Center data was ever served - the layout's
     * `requirePlatformAdmin` saw to that - but the page TITLE reached the
     * visitor, so "Control Center - Musuwo" sat in the tab and in any share
     * preview of a URL somebody was only guessing at.
     *
     * Bouncing here means the reply is a redirect from the edge and the
     * request never reaches a renderer. It does NOT replace the checks inside:
     * middleware deliberately does not query roles, so a signed-in customer
     * passes this and is refused by the layout, and every action checks again.
     */
    path.startsWith('/super-admin') ||
    /**
     * Registering a business.
     *
     * An application has to belong to somebody who can be written back to, and
     * a draft has to survive the browser being closed - so it needs an account.
     * Gated here rather than only in the page for the same reason as
     * /super-admin: a `redirect()` inside a server component is answered with a
     * 200 and a client-side navigation, so the visitor gets a flash of a form
     * they cannot use before being moved.
     */
    path.startsWith('/marketplace/apply')

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
     * /super-admin IS gated, above.
     */
    '/((?!_next/static|_next/image|favicon.ico|logo.png|hero|.*\\.(?:svg|png|jpg|jpeg|webp|mp4)$).*)',
  ],
}
