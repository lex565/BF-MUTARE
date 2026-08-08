'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Reveal } from '@pineberry/ui'
import { FEATURED, GALLERY, bodyTypesDelivered } from '@/app/data/deliveries'
import { DeliveryCard } from './DeliveryCard'
import { whatsappLink } from '@/app/data/site'

const ALL = 'All'
const FIRST_WALL_BATCH = 24

export function Deliveries() {
  const [filter, setFilter] = useState<string>(ALL)
  const [wallExpanded, setWallExpanded] = useState(false)
  const bodyTypes = useMemo(() => [ALL, ...bodyTypesDelivered()], [])

  const shown = useMemo(
    () =>
      filter === ALL
        ? FEATURED
        : FEATURED.filter((vehicle) => vehicle.bodyType === filter),
    [filter],
  )

  const wall = wallExpanded ? GALLERY : GALLERY.slice(0, FIRST_WALL_BATCH)

  return (
    <section className="mx-auto max-w-[86rem] px-gutter py-section">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Filter by body type"
      >
        {bodyTypes.map((type) => {
          const active = filter === type
          return (
            <button
              key={type}
              type="button"
              onClick={() => setFilter(type)}
              aria-pressed={active}
              className={`border px-4 py-2 font-mono text-micro uppercase tracking-label transition-colors duration-200 ${
                active
                  ? 'border-accent bg-accent text-paper'
                  : 'border-rule text-ink-soft hover:border-ink-faint hover:text-ink'
              }`}
            >
              {type}
            </button>
          )
        })}
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((vehicle, index) => (
          <Reveal
            key={vehicle.slug}
            as="div"
            from="up"
            delay={Math.min(index, 2) * 0.08}
            /* The Reveal wrapper is the grid item, so it — not the card — is
               what the row stretches. Without h-full here the cards end at
               whatever height their own copy happens to need and the row
               bottoms come out ragged. */
            className="h-full"
          >
            <DeliveryCard vehicle={vehicle} />
          </Reveal>
        ))}
      </div>

      {/* The wall. Dense, unlabelled, and deliberately large — the volume is
          the point. A tidy row of six would undersell a business that has been
          running for years. */}
      <div className="mt-24 border-t border-rule pt-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h3 className="text-h3">More handovers</h3>
          <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
            {GALLERY.length} photographs
          </p>
        </div>

        <ul className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {wall.map((shot, index) => (
            <li key={shot.src} className="group relative aspect-square overflow-hidden bg-paper-sunk">
              <Image
                src={shot.src}
                alt={shot.label ?? 'A vehicle delivered by BF Mutare'}
                fill
                /* Only the first screenful is worth prioritising; the rest
                   lazy-load as the user comes down the wall. */
                loading={index < 8 ? 'eager' : 'lazy'}
                sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 16vw"
                className="object-cover transition-transform duration-700 ease-[var(--ease-out-quint)] group-hover:scale-105"
              />
              {shot.label && (
                <span className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,rgba(19,18,16,0.9),transparent)] p-2 font-mono text-micro uppercase tracking-label text-ink opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  {shot.label}
                </span>
              )}
            </li>
          ))}
        </ul>

        {!wallExpanded && GALLERY.length > FIRST_WALL_BATCH && (
          <button
            type="button"
            onClick={() => setWallExpanded(true)}
            className="mt-8 border border-rule px-6 py-3 font-mono text-micro uppercase tracking-label text-ink-soft transition-colors duration-200 hover:border-accent hover:text-accent"
          >
            Show all {GALLERY.length}
          </button>
        )}

        <p className="mt-10 text-ink-soft">
          Want one of your own?{' '}
          <a
            href={whatsappLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="border-b border-accent pb-0.5 text-ink transition-colors hover:text-accent"
          >
            Tell us what you&rsquo;re after
          </a>
          .
        </p>
      </div>
    </section>
  )
}
