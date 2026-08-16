import type { ReactNode } from 'react'
import { cn } from './cn'

export interface EyebrowProps {
  children: ReactNode
  /** Optional index, rendered as a rule-marker like `01 -`. */
  index?: number
  className?: string
}

/**
 * Small uppercase section label. Both sites number their sections, which is a
 * cheap way to make a long page feel like a considered document instead of a
 * stack of unrelated blocks.
 */
export function Eyebrow({ children, index, className }: EyebrowProps) {
  return (
    <p
      className={cn(
        'flex items-center gap-3 font-mono text-micro uppercase tracking-label text-ink-faint',
        className,
      )}
    >
      {index !== undefined && (
        <span className="text-accent">{String(index).padStart(2, '0')}</span>
      )}
      <span aria-hidden className="h-px w-8 bg-rule" />
      {children}
    </p>
  )
}
