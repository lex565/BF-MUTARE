import { NextResponse } from 'next/server'

import { currentRelease, publicBetaEnabled } from '@/lib/platform/releases'

export const dynamic = 'force-dynamic'

/**
 * The one Android download address Musuwo publishes.
 *
 * WHY THIS EXISTS RATHER THAN A LINK TO THE ARTIFACT. The APK URL changes with
 * every build, and the old ones keep working - which is how a build containing
 * an authentication bypass stayed installable long after it was fixed, because
 * the link had been pasted into messages nobody could recall.
 *
 * `musuwo.online/beta/android` never changes. It resolves to whatever is
 * PUBLISHED at the moment somebody taps it, and resolves to nothing at all
 * when the beta is closed. That is the difference between a link you can
 * withdraw and one you cannot.
 *
 * 302, not 301: a permanent redirect would be cached by browsers and CDNs and
 * would keep sending people to a build we have since taken down. The whole
 * point is that this answer changes.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin

  if (!(await publicBetaEnabled())) {
    return NextResponse.redirect(`${origin}/beta?closed=1`, 302)
  }

  const release = await currentRelease('ANDROID')

  // No published build is a real state, not an error. Say so on the page
  // rather than returning a bare 404 that reads as a broken site.
  if (!release?.downloadUrl) {
    return NextResponse.redirect(`${origin}/beta?unavailable=1`, 302)
  }

  return NextResponse.redirect(release.downloadUrl, 302)
}
