import { SITE } from '@/app/data/site'

/**
 * A masthead rather than a sticky nav. This site is four screens long; a
 * floating bar that follows you down it would be borrowed startup furniture.
 * The holding company gets a letterhead.
 */
export function Masthead() {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-[80rem] flex-wrap items-baseline justify-between gap-4 px-gutter py-6">
        <a href="#top" className="flex items-baseline gap-2.5">
          {/* The mark: a pineberry is a white strawberry with red seeds. One
              red dot against the wordmark is the whole identity, and it is
              cheap enough to reproduce anywhere. */}
          <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
          <span className="font-display text-lead font-medium tracking-tight">
            Pineberry Holdings
          </span>
        </a>

        <nav aria-label="Primary">
          <ul className="flex items-center gap-7 font-mono text-micro uppercase tracking-label text-ink-faint">
            <li>
              <a href="#companies" className="transition-colors hover:text-ink">
                Companies
              </a>
            </li>
            <li>
              <a href="#approach" className="transition-colors hover:text-ink">
                Approach
              </a>
            </li>
            <li>
              <a
                href={`mailto:${SITE.email}`}
                className="transition-colors hover:text-accent"
              >
                Contact
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  )
}
