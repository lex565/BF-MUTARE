/**
 * The grey shapes shown while a page is still being fetched.
 *
 * WHY THESE AND NOT A SPINNER. A spinner says "something is happening" and
 * nothing else. These say what is about to arrive and where it will be, so the
 * page does not jump when it lands, and the eye has already found the price
 * column before the prices exist. On the connections this shop actually runs
 * on - a phone on mobile data in Mutare - that gap is not milliseconds.
 *
 * THE RULE FOR USING THEM: a skeleton must be the same shape as the real
 * thing. A three-column grid that resolves into a list is worse than no
 * skeleton at all, because the layout shifts under a thumb that is already
 * moving towards a button. Every `loading.tsx` in this app is built from the
 * page beside it, not from a generic template.
 *
 * They are deliberately quiet: one flat tone off the page background, a slow
 * sweep, no pulse. A loading state that draws attention to itself is a loading
 * state you notice, and the aim is the opposite.
 *
 * MOTION. The sweep is defined in globals.css and is switched off entirely
 * under `prefers-reduced-motion`, where the shapes simply sit still. Nothing
 * here conveys meaning through movement, so nothing is lost.
 *
 * SCREEN READERS. `SkeletonScreen` carries the one `role="status"` for the
 * whole page and announces "Loading" once. The individual shapes are
 * `aria-hidden`, because a screen reader reading out forty empty boxes is a
 * worse experience than the silence it replaces.
 */

/** One grey block. `className` sets its size, exactly as on a real element. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`skeleton block ${className}`} />
}

/**
 * A paragraph's worth of lines.
 *
 * The last line is short, because real text almost never fills its final line
 * and a perfect rectangle of "text" reads as a box rather than as words.
 */
export function SkeletonText({
  lines = 3,
  className = '',
}: {
  lines?: number
  className?: string
}) {
  return (
    <span aria-hidden className={`block space-y-2.5 ${className}`}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={`h-3.5 ${index === lines - 1 ? 'w-2/5' : 'w-full'}`}
        />
      ))}
    </span>
  )
}

/**
 * The page-level wrapper.
 *
 * Announces once, and holds the minimum height so the footer does not ride up
 * the screen and then get shoved back down when the real page arrives.
 */
export function SkeletonScreen({
  children,
  label = 'Loading',
}: {
  children: React.ReactNode
  label?: string
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="min-h-[60vh]">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

/**
 * A product card: image, name, one line of detail, price.
 *
 * The square image block is the important part - it is the tallest thing on
 * the card, so getting its height wrong is what makes a grid jump.
 */
export function SkeletonProductCard() {
  return (
    <span aria-hidden className="block border border-rule bg-paper">
      <Skeleton className="aspect-square w-full" />
      <span className="block p-4">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="mt-2.5 h-3 w-3/5" />
        <Skeleton className="mt-5 h-5 w-20" />
      </span>
    </span>
  )
}

/** A grid of them, at the same breakpoints the real catalogue uses. */
export function SkeletonProductGrid({ count = 8 }: { count?: number }) {
  return (
    <span
      aria-hidden
      className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4"
    >
      {Array.from({ length: count }, (_, index) => (
        <SkeletonProductCard key={index} />
      ))}
    </span>
  )
}

/**
 * A page heading: eyebrow, title, standfirst.
 *
 * Matches PageHeader, which is what sits at the top of most of these routes.
 */
export function SkeletonPageHeader() {
  return (
    <span aria-hidden className="block border-b border-rule bg-paper-sunk">
      <span className="mx-auto block max-w-[86rem] px-gutter py-section">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-6 h-11 w-3/5 max-w-lg" />
        <SkeletonText lines={2} className="mt-6 max-w-measure" />
      </span>
    </span>
  )
}

/**
 * A table of rows, as the admin and staff screens draw them.
 *
 * `columns` is the number of cells per row so the widths line up with the real
 * header; the first is wider because in every one of these tables the first
 * column is a name.
 */
export function SkeletonTable({
  rows = 6,
  columns = 4,
}: {
  rows?: number
  columns?: number
}) {
  return (
    <span aria-hidden className="block border border-rule bg-paper">
      <span className="flex gap-4 border-b border-rule bg-paper-sunk px-5 py-3.5">
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton
            key={index}
            className={`h-3 ${index === 0 ? 'w-40' : 'w-20'}`}
          />
        ))}
      </span>
      {Array.from({ length: rows }, (_, row) => (
        <span
          key={row}
          className="flex items-center gap-4 border-b border-rule px-5 py-4 last:border-b-0"
        >
          {Array.from({ length: columns }, (_, index) => (
            <Skeleton
              key={index}
              className={`h-4 ${index === 0 ? 'w-40' : 'w-20'}`}
            />
          ))}
        </span>
      ))}
    </span>
  )
}

/** A stat tile, as used across the admin dashboard and the reports screen. */
export function SkeletonStatRow({ count = 4 }: { count?: number }) {
  return (
    <span aria-hidden className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className="block border border-rule bg-paper p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-8 w-16" />
        </span>
      ))}
    </span>
  )
}
