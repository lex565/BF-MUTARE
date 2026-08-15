'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { BRANDS, brandHref } from '@pineberry/ui'

/**
 * The holdings masthead.
 *
 * The background is a street in Mutare with the Eastern Highlands behind it —
 * the same footage BF Mutare uses, reused here deliberately. It is the town
 * every one of these four businesses trades from, so on the parent's site it
 * reads as place rather than as product. Scrimmed hard and desaturated for
 * exactly that reason: this is a holding company, and the video should be
 * atmosphere, not the subject.
 *
 * Load-bearing details:
 * - `muted` is required or browsers block autoplay outright. `playsInline`
 *   stops iOS forcing fullscreen.
 * - The <video> ships with no `src`; the effect attaches one only after
 *   checking reduced-motion and save-data, so a 3.5MB loop never lands on
 *   someone's mobile data. The poster is a real photograph, so the hero is
 *   never an empty box.
 */
export function Masthead() {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection

    if (reduced || connection?.saveData) return

    video.src = '/video/mutare.mp4'
    video.play().catch(() => {})
  }, [])

  return (
    <header className="relative isolate min-h-[86vh] overflow-hidden bg-ink">
      <div className="absolute inset-0 -z-10">
        <video
          ref={videoRef}
          className="h-full w-full object-cover object-[50%_36%] saturate-[0.55]"
          poster="/video/mutare-poster.jpg"
          muted
          loop
          playsInline
          preload="none"
          aria-hidden
          tabIndex={-1}
        />
      </div>

      {/* Two scrims. The navy wash ties the footage to the brand colour
          instead of leaving a raw video under the type. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(23,56,79,0.82)_0%,rgba(13,37,54,0.72)_45%,rgba(20,24,28,0.92)_100%)]"
      />

      <div className="mx-auto flex min-h-[86vh] max-w-[80rem] flex-col px-gutter pb-16 pt-8">
        <nav
          aria-label="Primary"
          className="flex flex-wrap items-center justify-between gap-6"
        >
          <Link href="/" className="flex items-center gap-2.5">
            {/* The pineberry red survives here, as the dot. It is the one place
                the name's own colour still earns its keep. */}
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full bg-support"
            />
            <span className="font-display text-lead text-paper">
              Pineberry Holdings
            </span>
          </Link>

          <ul className="flex flex-wrap items-center gap-x-7 gap-y-2">
            {[
              { href: '/companies', label: 'Companies' },
              { href: '/approach', label: 'Approach' },
              { href: '/contact', label: 'Contact' },
            ].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="font-mono text-micro uppercase tracking-label text-paper/70 transition-colors hover:text-paper"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto pt-24">
          <p className="font-mono text-micro uppercase tracking-label text-paper/60">
            Mutare, Zimbabwe
          </p>

          <h1 className="mt-7 max-w-[15ch] text-mega leading-[0.95] text-paper">
            A small group of{' '}
            <span className="italic text-accent-wash">real</span> businesses
          </h1>

          <p className="mt-9 max-w-[54ch] text-h4 font-normal leading-snug text-paper/85">
            Four companies in Zimbabwe. Each one has staff, premises, customers,
            and someone whose name is on it.
          </p>

          {/* The four companies, by their own marks. A holding company's job on
              its own front page is to show what it owns, and four real logos do
              that faster than four names in a row.

              Each sits on a light plate rather than straight on the video.
              That is not decoration: the four marks were drawn for four
              different grounds — Speed Motors' is pure black and would vanish
              entirely on this dark hero — and recolouring somebody's logo to
              suit a background is not ours to do. A common plate lets all four
              keep their own artwork and stay legible. */}
          <ul className="mt-12 flex flex-wrap items-center gap-3">
            {BRANDS.map((brand) => (
              <li key={brand.slug}>
                <a
                  href={brandHref(brand)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex h-16 w-32 items-center justify-center rounded-sm bg-paper/92 px-4 transition duration-300 hover:bg-paper sm:h-[4.5rem] sm:w-40"
                >
                  <span className="sr-only">
                    Visit {brand.fullName ?? brand.name}
                  </span>
                  {brand.logo ? (
                    <Image
                      src={brand.logo}
                      alt=""
                      width={320}
                      height={160}
                      className="h-auto max-h-11 w-auto max-w-full object-contain transition-transform duration-300 group-hover:scale-[1.04] sm:max-h-12"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="font-display text-h4"
                      style={{ color: brand.palette.accent }}
                    >
                      {brand.name}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </header>
  )
}
