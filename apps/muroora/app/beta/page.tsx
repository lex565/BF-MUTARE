import type { Metadata } from 'next'

import {
  betaFeedbackEnabled,
  currentRelease,
  placeholderRelease,
  publicBetaEnabled,
} from '@/lib/platform/releases'
import { currentUser } from '@/lib/auth'
import { siteOrigin } from '@/lib/brand'
import { BetaFeedbackForm } from '@/app/beta/BetaFeedbackForm'
import { QrCode } from '@/app/beta/QrCode'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Test the Musuwo app',
  description:
    'Install the Musuwo beta for Android and help us find what is broken before it reaches customers.',
}

/**
 * The one page Musuwo tells testers to go to.
 *
 * EVERY NUMBER ON IT IS READ FROM THE DATABASE. §15 of the brief says never
 * fabricate values and it is right for a specific reason: a version number or
 * file size that is merely plausible makes it impossible for a tester to tell
 * whether the build on their phone is the one being described. So if the
 * release row does not say, this page does not either.
 *
 * The download button points at /beta/android, never at the artifact. That
 * indirection is what makes a build revocable - see the route for the longer
 * version.
 */
export default async function BetaPage({
  searchParams,
}: {
  searchParams: Promise<{ closed?: string; unavailable?: string; ios?: string }>
}) {
  const { closed, unavailable, ios } = await searchParams

  const [open, feedbackOn, android, iosRow, user] = await Promise.all([
    publicBetaEnabled(),
    betaFeedbackEnabled(),
    currentRelease('ANDROID'),
    placeholderRelease('IOS'),
    currentUser(),
  ])

  const origin = siteOrigin()
  const androidUrl = `${origin}/beta/android`

  const size = android?.fileSizeBytes
    ? `${(android.fileSizeBytes / 1024 / 1024).toFixed(0)} MB`
    : null

  return (
    <main>
      <section className="border-b border-rule bg-paper-sunk">
        <div className="mx-auto max-w-[86rem] px-gutter py-14">
          <p className="font-mono text-micro uppercase tracking-label text-accent">
            Private beta
          </p>
          <h1 className="mt-4 max-w-[16ch] text-mega leading-[.95]">
            Help us break the Musuwo app.
          </h1>
          <p className="mt-6 max-w-2xl text-lead text-ink-soft">
            This is a test release. Things will be missing and some of it will
            not work. Telling us what went wrong is the entire point.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[86rem] px-gutter py-section">
        {closed && (
          <p role="status" className="mb-8 max-w-measure border-l-4 border-accent bg-accent-wash px-5 py-4">
            The beta is closed at the moment. Nothing is downloadable until it
            reopens.
          </p>
        )}
        {unavailable && (
          <p role="status" className="mb-8 max-w-measure border-l-4 border-accent bg-accent-wash px-5 py-4">
            There is no Android build published right now. This page will show
            one as soon as there is.
          </p>
        )}
        {ios && (
          <p role="status" className="mb-8 max-w-measure border-l-4 border-support bg-paper-sunk px-5 py-4">
            There is no iPhone build yet. See below.
          </p>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          {/* ------------------------------------------------------ Android */}
          <div className="border border-rule bg-paper p-7">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-h2">Android</h2>
              {android && (
                <span className="chip chip-live">Version {android.version}</span>
              )}
            </div>

            {!open ? (
              <p className="mt-6 text-ink-soft">
                The beta is closed at the moment. It will reopen here.
              </p>
            ) : !android ? (
              <p className="mt-6 text-ink-soft">
                No build is published yet. Nothing to install today.
              </p>
            ) : (
              <>
                <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-rule py-5">
                  <div>
                    <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                      Released
                    </dt>
                    <dd className="mt-1">
                      {android.releaseDate.toISOString().slice(0, 10)}
                    </dd>
                  </div>
                  {size && (
                    <div>
                      <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                        Download size
                      </dt>
                      <dd className="mt-1">{size}</dd>
                    </div>
                  )}
                </dl>

                <a
                  href="/beta/android"
                  className="mt-6 block bg-accent px-8 py-5 text-center font-mono text-small font-bold uppercase tracking-label text-white transition-colors hover:bg-accent-deep"
                >
                  Download for Android
                </a>

                {android.releaseNotes && (
                  <>
                    <h3 className="mt-8 font-mono text-micro uppercase tracking-label text-ink-faint">
                      What changed
                    </h3>
                    <p className="mt-3 whitespace-pre-line text-ink-soft">
                      {android.releaseNotes}
                    </p>
                  </>
                )}

                {android.knownIssues && (
                  <>
                    <h3 className="mt-7 font-mono text-micro uppercase tracking-label text-ink-faint">
                      Known problems
                    </h3>
                    <p className="mt-3 whitespace-pre-line text-ink-soft">
                      {android.knownIssues}
                    </p>
                  </>
                )}

                {/* Android refuses APKs from outside the Play Store until the
                    person allows it, and the warnings it shows are alarming if
                    nobody has told you they are coming. Saying so here is the
                    difference between a tester installing and giving up. */}
                <h3 className="mt-8 font-mono text-micro uppercase tracking-label text-ink-faint">
                  Installing it
                </h3>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-ink-soft">
                  <li>Tap the button above. The file downloads.</li>
                  <li>Open it from your notifications or your Downloads folder.</li>
                  <li>
                    Android will warn you that the app is not from the Play
                    Store. That is expected for a beta. Choose to allow it from
                    this browser when asked.
                  </li>
                  <li>Install, then open Musuwo.</li>
                </ol>

                <p className="mt-6 border-l-4 border-accent bg-accent-wash px-5 py-4 text-small">
                  <strong>Only install from this page.</strong> If somebody
                  sends you a Musuwo APK by WhatsApp or email, do not install
                  it. Come here instead: this address always points at the build
                  we are actually supporting, and old builds get withdrawn for
                  good reasons.
                </p>
              </>
            )}
          </div>

          {/* ---------------------------------------------------- iOS + QR */}
          <div className="space-y-8">
            <div className="border border-rule bg-paper p-7">
              <h2 className="text-h2">iPhone</h2>
              <p className="mt-4 text-ink-soft">
                {iosRow?.releaseNotes ??
                  'An iPhone build has not been made yet.'}
              </p>
              <p className="mt-5 text-small text-ink-faint">
                When there is one, it will appear here and at{' '}
                <code className="font-mono">{origin}/beta/ios</code>. Any link
                claiming to be a Musuwo TestFlight invitation before then is not
                from us.
              </p>
            </div>

            {/* On a laptop the download is useless - the phone is the thing
                that needs it. A code beats typing a URL across devices. */}
            {open && android && (
              <div className="border border-rule bg-paper p-7 text-center">
                <h2 className="text-h3">On your phone</h2>
                <p className="mt-3 text-small text-ink-soft">
                  Point your camera at this to open the download.
                </p>
                <div className="mt-6 flex justify-center">
                  <QrCode value={androidUrl} size={190} />
                </div>
                <p className="mt-5 break-all font-mono text-micro text-ink-faint">
                  {androidUrl}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* -------------------------------------------------------- feedback */}
        {feedbackOn && (
          <div className="mt-12 max-w-measure">
            <h2 className="text-h2">Tell us what went wrong</h2>
            <p className="mt-3 text-ink-soft">
              You do not need to be signed in. If the problem is that you cannot
              sign in, that is exactly the report we want.
            </p>
            <BetaFeedbackForm
              signedInAs={user?.email ?? null}
              currentVersion={android?.version ?? null}
            />
          </div>
        )}
      </section>
    </main>
  )
}
