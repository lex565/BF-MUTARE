import { NextResponse } from 'next/server'

import { checkAppVersion } from '@/lib/platform/releases'

export const dynamic = 'force-dynamic'

/**
 * What the app asks on launch: am I still allowed to run?
 *
 * PUBLIC AND UNAUTHENTICATED, deliberately. A build that has been blocked must
 * be told so BEFORE anybody signs in - the bypass build's whole problem was
 * that it let people in, so gating the "stop using this" message behind a
 * login would be exactly backwards.
 *
 * It returns no secrets and reads nothing about the caller. The most it
 * reveals is which version of a public beta is current, which is printed on
 * the beta page anyway.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const platform = url.searchParams.get('platform') === 'IOS' ? 'IOS' : 'ANDROID'
  const version = url.searchParams.get('version')?.trim()

  if (!version) {
    return NextResponse.json(
      { error: 'Tell us which version you are running: ?version=0.2.0' },
      { status: 400 },
    )
  }

  const verdict = await checkAppVersion({ platform, version })

  return NextResponse.json(verdict, {
    // Short cache. Long enough to absorb a crowd of apps launching at once,
    // short enough that blocking a build takes effect within a minute.
    headers: { 'Cache-Control': 'public, max-age=60' },
  })
}
