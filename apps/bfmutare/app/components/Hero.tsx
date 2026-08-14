'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { FINANCE, SITE, STATS, whatsappLink } from '@/app/data/site'

/**
 * Video hero.
 *
 * Load-bearing details, so nobody strips them out later:
 *
 * - `muted` is required, not stylistic. Browsers block autoplay with sound, so
 *   without it the video simply never starts. `playsInline` is the same story
 *   on iOS, which otherwise throws the video into fullscreen.
 * - `poster` shows a real photograph while the video downloads, so the hero is
 *   never an empty black box on a slow connection — which is most of this
 *   audience.
 * - Reduced motion and save-data get the poster and no video at all. A 3.5MB
 *   autoplaying loop is a real cost on metered mobile data.
 */
export function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null)

  /**
   * The <video> renders with a poster but deliberately no `src`. This effect
   * attaches the source only once we know the visitor wants it — which is the
   * legitimate use of an effect here: pushing state into an external system
   * (the media element) rather than back into React. Doing it with useState
   * would trigger a cascading render for no benefit, and would also mean the
   * server rendering markup for a video it cannot make a decision about.
   */
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection

    // Reduced motion or save-data keeps the poster and downloads nothing. A
    // 3.5MB autoplaying loop is a real cost on metered mobile data.
    if (reduced || connection?.saveData) return

    video.src = '/video/hero.mp4'
    // Some browsers reject the autoplay promise even when muted. Swallow it —
    // the poster is already showing, so there is nothing to recover from.
    video.play().catch(() => {})
  }, [])

  return (
    <section className="relative isolate min-h-dvh overflow-hidden">
      <div className="absolute inset-0 -z-10">
        {/* No `src` here on purpose — see the effect above. The poster is a
            real photograph, so the hero is never an empty black box while the
            video downloads, and stays a still if it never does. */}
        {/* The source is 720x1280 — portrait, shot on a phone. On a wide
            desktop hero, object-cover fills the width and only about a third
            of the frame's height survives the crop. Biasing the origin above
            centre keeps the car body, road and hills in shot instead of
            landing on the tarmac in the lower third. On phones the viewport is
            portrait too, so the whole frame shows and this has no effect. */}
        <video
          ref={videoRef}
          className="h-full w-full object-cover object-[50%_38%]"
          poster="/featured/impreza-sport-black-01.jpg"
          muted
          loop
          playsInline
          preload="none"
          aria-hidden
          tabIndex={-1}
        />
      </div>

      {/* Video is far less predictable than a still, so the scrims are heavier
          than they would be over a photograph. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(120%_100%_at_50%_30%,rgba(19,18,16,0.25)_0%,rgba(19,18,16,0.72)_100%)]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 -z-10 h-3/4 bg-[linear-gradient(to_top,var(--color-paper)_2%,rgba(19,18,16,0.94)_30%,rgba(19,18,16,0.6)_62%,transparent_100%)]"
      />

      {/* Hard against the left gutter, deliberately. An earlier pass indented
          this block inboard; the client wanted it back on the edge, which is
          also the stronger composition — the headline starts on the same
          vertical line as the nav logo above it and the sections below it. */}
      <div className="mx-auto flex min-h-dvh max-w-[86rem] flex-col justify-end px-gutter pb-24 pt-40">
        <div className="w-full">
          <p className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-small uppercase tracking-label text-ink-soft">
            <span className="plate">Mutare</span>
            <span>Zimbabwe</span>
            <span aria-hidden className="h-px w-10 bg-rule" />
            <span>Vehicle imports</span>
          </p>

          {/* The line carries the brand colour rather than sitting in flat
              white — plate yellow on the verb that matters.

              Sized here rather than by raising --text-mega, because that token
              is shared with the team page's initials panel and with Pineberry's
              statement block; the client asked for a bigger HOME headline, not
              a bigger everything. Tops out at 9rem — beyond that "We bring them
              home" stops fitting two lines on a 1280px laptop, which is what
              most of this audience opens the site on. */}
          <h1 className="max-w-[12ch] text-[clamp(3.25rem,1.4rem+7.4vw,9rem)] leading-[0.86] tracking-mega">
            We bring them <span className="text-accent">home</span>
          </h1>

          <p className="mt-10 max-w-[42ch] text-h3 font-normal leading-snug text-ink">
            Based in Mutare, operating right around Zimbabwe. {SITE.name}{' '}
            imports vehicles to order and delivers them to their owners.
          </p>

        {/* The payment plan, given real estate. This is the thing that stops
            someone scrolling past, so it gets a panel of its own rather than a
            line of body copy. */}
        <Link
          href="/contact"
          className="group mt-10 flex max-w-3xl flex-col gap-4 border-l-4 border-accent bg-paper-sunk/80 p-7 backdrop-blur-sm transition-colors duration-300 hover:bg-paper-sunk sm:flex-row sm:items-center sm:gap-8"
        >
          {/* Headline and support stack in their own column rather than sitting
              as two siblings in the row. As siblings the nowrap headline took
              its full width and the support copy was squeezed to a one-word
              column — "Spread / the / cost / of / your" down the page. */}
          <span className="min-w-0 flex-1">
            {/* Held to one line from sm up — wrapped, "TO PAY" drops onto its
                own line and throws the panel out of alignment. On phones the
                panel stacks, so wrapping there is fine. */}
            <span className="block font-display text-h2 font-bold uppercase leading-none text-accent sm:whitespace-nowrap">
              {FINANCE.headline}
            </span>
            <span className="mt-2 block max-w-[38ch] text-ink-soft">
              {FINANCE.support}
            </span>
          </span>
          <span
            aria-hidden
            className="font-mono text-micro uppercase tracking-label text-ink transition-transform duration-300 ease-[var(--ease-out-quint)] group-hover:translate-x-1 sm:ml-auto sm:shrink-0"
          >
            Ask how →
          </span>
        </Link>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a
            href={whatsappLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 bg-accent px-7 py-4 font-mono text-small font-bold uppercase tracking-label text-paper transition-colors duration-200 hover:bg-accent-deep"
          >
            Import a vehicle
          </a>
          <Link
            href="/deliveries"
            className="group inline-flex items-center gap-3 border border-rule px-7 py-4 font-mono text-small uppercase tracking-label text-ink transition-colors duration-200 hover:border-ink"
          >
            See what we&rsquo;ve delivered
            <span
              aria-hidden
              className="transition-transform duration-300 ease-[var(--ease-out-quint)] group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        </div>

        {/* Stats render only when a real figure exists. An invented total would
            undersell a business that has been running for years. */}
        {(STATS.totalDelivered || STATS.operatingSince) && (
          <dl className="mt-16 flex flex-wrap gap-x-16 gap-y-6 border-t border-rule pt-8">
            {STATS.totalDelivered && (
              <div>
                <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                  Vehicles delivered
                </dt>
                <dd className="mt-1 font-display text-h2 font-bold text-accent">
                  {STATS.totalDelivered.toLocaleString('en-US')}
                </dd>
              </div>
            )}
            {STATS.operatingSince && (
              <div>
                <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                  Trading since
                </dt>
                <dd className="mt-1 font-display text-h2 font-bold">
                  {STATS.operatingSince}
                </dd>
              </div>
            )}
            </dl>
          )}
        </div>
      </div>
    </section>
  )
}
