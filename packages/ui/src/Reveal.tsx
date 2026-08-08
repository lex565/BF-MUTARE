'use client'

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'
import { cn } from './cn'

type Direction = 'up' | 'down' | 'left' | 'right' | 'none'

const OFFSET: Record<Direction, string> = {
  up: 'translate3d(0, 28px, 0)',
  down: 'translate3d(0, -28px, 0)',
  left: 'translate3d(28px, 0, 0)',
  right: 'translate3d(-28px, 0, 0)',
  none: 'none',
}

export interface RevealProps {
  children: ReactNode
  /** Which way the element travels in from. */
  from?: Direction
  /** Seconds of delay — use to stagger siblings by index. */
  delay?: number
  /** Fraction of the element that must be visible before it fires. */
  threshold?: number
  as?: ElementType
  className?: string
}

/**
 * Scroll reveal built on IntersectionObserver and a CSS transition rather than
 * a motion library. Two reasons: it keeps the shared package dependency-free,
 * and it animates only `opacity`/`transform`, so it stays on the compositor
 * even when a section has forty of them.
 *
 * Fires once. Content that re-animates every time it re-enters the viewport is
 * distracting on a long marketing page.
 */
export function Reveal({
  children,
  from = 'up',
  delay = 0,
  threshold = 0.15,
  as: Tag = 'div',
  className,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    // Anyone who has asked for less motion gets the final state immediately.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          observer.disconnect()
        }
      },
      { threshold, rootMargin: '0px 0px -8% 0px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [threshold])

  return (
    <Tag
      ref={ref}
      className={cn('will-change-[opacity,transform]', className)}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : OFFSET[from],
        transition: `opacity var(--duration-base) var(--ease-out-quint) ${delay}s, transform var(--duration-base) var(--ease-out-quint) ${delay}s`,
      }}
    >
      {children}
    </Tag>
  )
}
