import type { ReactNode } from 'react'

export function PageHeader({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string
  title: ReactNode
  intro?: ReactNode
}) {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto max-w-[86rem] px-gutter pb-14 pt-16 md:pb-16 md:pt-20">
        <p className="flex items-center gap-3 font-mono text-micro uppercase tracking-label text-ink-faint">
          <span aria-hidden className="h-px w-8 bg-accent" />
          {eyebrow}
        </p>
        <h1 className="mt-6 max-w-[18ch] text-h1">{title}</h1>
        {intro && (
          <p className="mt-7 max-w-measure text-lead text-ink-soft">{intro}</p>
        )}
      </div>
    </header>
  )
}
