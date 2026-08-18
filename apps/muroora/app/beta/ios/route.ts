import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * iOS, which does not exist yet.
 *
 * NO TESTFLIGHT URL IS INVENTED HERE, and that is a rule rather than an
 * oversight: a plausible-looking testflight.apple.com link that goes nowhere
 * teaches testers that Musuwo links cannot be trusted, and the next one they
 * are sent - a real one - looks exactly as doubtful.
 *
 * The address exists now so QR codes, printed material and messages can point
 * at it today and start working the day a build lands, without anybody having
 * to reissue anything.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin
  return NextResponse.redirect(`${origin}/beta?ios=1`, 302)
}
