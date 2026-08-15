'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { SITE, SERVICES, yearsTrading } from '@/app/data/site'

/**
 * Video hero.
 *
 * The rest of this site is light — concrete paper, black ink, hairline rules,
 * because the company's logo is pure black and a dark page would mean
 * inverting it. The hero is the one dark band, which is also what a workshop
 * actually looks like: a dim bay with a light over the engine.
 *
 * THE FOOTAGE IS STOCK, AND THAT IS A PLACEHOLDER, NOT A CHOICE.
 * It is a licensed Mixkit clip of a mechanic in an engine bay — not this
 * workshop, and not a Speed Motors employee. It was picked over the obvious
 * alternative (a posed portrait of a mechanic facing camera) precisely because
 * the figure reads as anonymous: head down, working. A recognisable face here
 * would imply he works here, which would be a lie about a real business.
 * Replace it the moment there is thirty seconds of the actual bay.
 *
 * Load-bearing details, same as the other heroes in the group:
 * - `muted` is required or browsers refuse to autoplay at all.
 * - `playsInline` stops iOS forcing fullscreen.
 * - The <video> ships with no `src`; it is attached only after checking
 *   reduced-motion and save-data, so 5MB never lands on metered mobile data.
 * - The poster is a real frame from the clip, so the band is never empty.
 */
export function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection

    if (reduced || connection?.saveData) return

    video.src = '/video/workshop.mp4'
    video.play().catch(() => {})
  }, [])

  return (
    <section className="relative isolate overflow-hidden border-b border-rule bg-ink">
      <div className="absolute inset-0 -z-20">
        <video
          ref={videoRef}
          className="h-full w-full object-cover object-[52%_45%]"
          poster="/video/workshop-poster.jpg"
          muted
          loop
          playsInline
          preload="none"
          aria-hidden
          tabIndex={-1}
        />
      </div>

      {/* Neutral near-black rather than the workshop blue: the footage is
          already cool, and tinting it further turns the whole band grey. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(10,10,10,0.90)_0%,rgba(10,10,10,0.72)_34%,rgba(10,10,10,0.44)_66%,rgba(10,10,10,0.30)_100%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(10,10,10,0.62)_0%,rgba(10,10,10,0.24)_48%,transparent_78%)]"
      />

      <div className="relative mx-auto flex min-h-[34rem] max-w-[86rem] flex-col justify-end px-gutter pb-20 pt-28 md:min-h-[40rem] md:pb-24">
        <p className="font-mono text-micro uppercase tracking-label text-accent-wash">
          {SITE.country} · Est. {SITE.founded}
        </p>

        <h1 className="mt-7 max-w-[17ch] text-mega leading-[0.9] text-white">
          Engine, gearbox, <span className="text-accent-wash">suspension</span>
        </h1>

        <p className="mt-8 max-w-[52ch] text-lead text-white/85">
          {SITE.fullName} is a working repair shop, not a parts counter. The
          heavy jobs — overhauls, rebuilds, the fault nobody else could find —
          are the ones it was built for.
        </p>

        <div className="mt-11 flex flex-wrap items-center gap-4">
          <Link
            href="/services"
            className="bg-white px-8 py-4 font-mono text-small font-bold uppercase tracking-label text-ink transition-colors duration-200 hover:bg-accent-wash"
          >
            What we do
          </Link>
          <Link
            href="/contact"
            className="group inline-flex items-center gap-3 border border-white/60 px-8 py-4 font-mono text-small uppercase tracking-label text-white transition-colors duration-200 hover:bg-white hover:text-ink"
          >
            Book it in
            <span
              aria-hidden
              className="transition-transform duration-300 group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        </div>

        <dl className="mt-14 grid max-w-2xl grid-cols-3 gap-x-10 border-t border-white/25 pt-7">
          <div>
            <dt className="font-mono text-micro uppercase tracking-label text-white/55">
              Trading since
            </dt>
            <dd className="mt-1 font-display text-h3 font-bold text-white">
              {SITE.founded}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-micro uppercase tracking-label text-white/55">
              Years
            </dt>
            <dd className="mt-1 font-display text-h3 font-bold text-accent-wash">
              {yearsTrading()}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-micro uppercase tracking-label text-white/55">
              Services
            </dt>
            <dd className="mt-1 font-display text-h3 font-bold text-white">
              {SERVICES.length}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
