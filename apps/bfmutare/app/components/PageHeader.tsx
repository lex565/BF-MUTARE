import type { ReactNode } from 'react'

/**
 * The masthead for every page except home.
 *
 * Home has the video; the inner pages get a quiet typographic head instead, so
 * arriving on one feels like opening a new page rather than landing halfway
 * down the same endless scroll. The top padding clears the fixed nav plus the
 * finance ribbon above it.
 */
export function PageHeader({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string
  title: ReactNode
  intro?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto max-w-[86rem] px-gutter pb-16 pt-40 md:pb-20 md:pt-48">
        <p className="flex items-center gap-3 font-mono text-micro uppercase tracking-label text-ink-faint">
          <span aria-hidden className="h-px w-8 bg-accent" />
          {eyebrow}
        </p>

        <h1 className="mt-6 max-w-[18ch] text-h1">{title}</h1>

        {intro && (
          <p className="mt-8 max-w-measure text-lead text-ink-soft">{intro}</p>
        )}

        {children}
      </div>
    </header>
  )
}
