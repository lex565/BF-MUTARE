'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'

import { DEPARTMENTS, initialsOf } from '@/app/data/team'

/**
 * Department heads as a proper tab set — one panel visible at a time, rather
 * than five stacked cards you scroll past.
 *
 * Built to the ARIA tabs pattern rather than with buttons that toggle state,
 * because that pattern carries real keyboard behaviour people expect:
 * left/right arrows move between tabs, Home/End jump to the ends, and only the
 * active tab is in the page tab order. Getting this wrong is the usual reason
 * custom tabs are unusable without a mouse.
 */
export function Team() {
  const [active, setActive] = useState(0)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  const focusTab = (index: number) => {
    const next = (index + DEPARTMENTS.length) % DEPARTMENTS.length
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        focusTab(active + 1)
        break
      case 'ArrowLeft':
        event.preventDefault()
        focusTab(active - 1)
        break
      case 'Home':
        event.preventDefault()
        focusTab(0)
        break
      case 'End':
        event.preventDefault()
        focusTab(DEPARTMENTS.length - 1)
        break
    }
  }

  const head = DEPARTMENTS[active]

  return (
    <section className="mx-auto max-w-[86rem] px-gutter py-section">
      <div>
        <div
          role="tablist"
          aria-label="Departments"
          onKeyDown={onKeyDown}
          className="flex flex-wrap gap-2 border-b border-rule pb-4"
        >
          {DEPARTMENTS.map((department, index) => {
            const selected = index === active
            return (
              <button
                key={department.id}
                ref={(node) => {
                  tabRefs.current[index] = node
                }}
                role="tab"
                id={`tab-${department.id}`}
                aria-selected={selected}
                aria-controls={`panel-${department.id}`}
                /* Only the active tab stays reachable by Tab; the arrows move
                   within the set. This is what the pattern requires. */
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(index)}
                className={`border px-5 py-2.5 font-mono text-micro uppercase tracking-label transition-colors duration-200 ${
                  selected
                    ? 'border-accent bg-accent text-paper'
                    : 'border-rule text-ink-soft hover:border-ink-faint hover:text-ink'
                }`}
              >
                {department.department}
              </button>
            )
          })}
        </div>

        <div
          role="tabpanel"
          id={`panel-${head.id}`}
          aria-labelledby={`tab-${head.id}`}
          /* Keyed so React remounts on change — that restarts the entrance
             transition instead of cross-fading two people's details. */
          key={head.id}
          className="mt-12 grid grid-cols-1 gap-12 duration-500 ease-[var(--ease-out-quint)] motion-safe:animate-[fadeUp_var(--duration-base)_var(--ease-out-quint)] lg:grid-cols-12"
        >
          <div className="lg:col-span-4">
            <div className="relative aspect-4/5 overflow-hidden border border-rule bg-paper-sunk">
              {head.photo ? (
                <Image
                  src={head.photo}
                  alt={head.name ?? head.department}
                  fill
                  sizes="(max-width: 1024px) 100vw, 30vw"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-4">
                  <span className="font-display text-mega leading-none text-rule">
                    {initialsOf(head.name)}
                  </span>
                  <span className="font-mono text-micro uppercase tracking-label text-ink-faint">
                    Photo to come
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-8">
            <p className="font-mono text-micro uppercase tracking-label text-accent">
              {head.department}
            </p>

            <h3 className="mt-4 text-h2">
              {head.name ?? (
                <span className="text-ink-faint">Name to be confirmed</span>
              )}
            </h3>

            <p className="mt-3 font-mono text-small uppercase tracking-label text-ink-soft">
              {head.title ?? `Head of ${head.department}`}
            </p>

            <div className="mt-8 max-w-measure space-y-4 border-t border-rule pt-8">
              <p className="text-lead text-ink-soft">{head.remit}</p>
              {head.bio && <p className="text-ink-soft">{head.bio}</p>}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
