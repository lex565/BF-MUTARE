'use client'

import { useEffect, useRef } from 'react'

/**
 * The deliveries masthead: a real handover, playing.
 *
 * WHY THIS IS A SPLIT LAYOUT AND NOT A FULL-BLEED BANNER
 * The clip is 360x640 — portrait, filmed on a phone, 13 seconds. Stretched
 * across a 1400px header it would be upscaled about four times and look like
 * exactly what it is: a WhatsApp video blown up past its resolution. Framed as
 * a portrait panel beside the headline it sits at close to its native size,
 * stays sharp, and the phone-footage quality reads as authenticity rather than
 * as a production mistake. It is a customer taking delivery of their car, which
 * is worth more here than a polished stock plate.
 *
 * Load-bearing details, carried over from the home hero, so nobody strips them:
 *
 * - `muted` is required, not stylistic — browsers block autoplay with sound, so
 *   without it the video never starts. The client asked for it muted anyway;
 *   both reasons point the same way.
 * - `playsInline` stops iOS throwing the video into fullscreen on play.
 * - `poster` is a frame pulled from the clip itself, so the panel is never an
 *   empty black box while the video downloads.
 * - Reduced motion and save-data get the poster and download no video at all.
 * - No controls and `aria-hidden`: it is decorative, it carries no audio and no
 *   information that is not in the surrounding copy, so it should not be a stop
 *   on the keyboard path or an announced element.
 */
export function DeliveryHero() {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection

    if (reduced || connection?.saveData) return

    video.src = '/video/delivery.mp4'
    // Some browsers reject the autoplay promise even when muted. Swallow it —
    // the poster is already showing, so there is nothing to recover from.
    video.play().catch(() => {})
  }, [])

  return (
    <header className="border-b border-rule">
      <div className="mx-auto max-w-[86rem] px-gutter pb-16 pt-40 md:pb-20 md:pt-48">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <p className="flex items-center gap-3 font-mono text-micro uppercase tracking-label text-ink-faint">
              <span aria-hidden className="h-px w-8 bg-accent" />
              Deliveries
            </p>

            <h1 className="mt-6 max-w-[14ch] text-h1">Cars we brought in</h1>

            <p className="mt-8 max-w-measure text-lead text-ink-soft">
              Every vehicle here is already with its owner. This is a selection
              of what has come through — not the full record.
            </p>
          </div>

          <div className="lg:col-span-5">
            <figure className="relative mx-auto w-full max-w-[22rem] lg:ml-auto lg:mr-0">
              {/* The accent rule anchors the panel to the rest of the page's
                  language rather than leaving a video floating on its own. */}
              <div className="relative aspect-9/16 overflow-hidden border-l-4 border-accent bg-paper-sunk">
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  poster="/video/delivery-poster.jpg"
                  muted
                  loop
                  playsInline
                  preload="none"
                  aria-hidden
                  tabIndex={-1}
                />
              </div>
              <figcaption className="mt-4 font-mono text-micro uppercase tracking-label text-ink-faint">
                A handover, filmed on the day
              </figcaption>
            </figure>
          </div>
        </div>
      </div>
    </header>
  )
}
