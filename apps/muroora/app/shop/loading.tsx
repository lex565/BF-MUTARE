import {
  Skeleton,
  SkeletonProductGrid,
  SkeletonScreen,
} from '@/app/components/Skeleton'

/**
 * The category rail above the grid.
 *
 * Written out rather than computed, because Tailwind reads these files as text
 * and never sees a class built at runtime - `w-${n}` compiles to nothing at
 * all and the chips come out zero-width.
 *
 * Uneven on purpose: category names are different lengths, and five identical
 * pills read as a control rather than as a row of words.
 */
const RAIL = ['w-24', 'w-20', 'w-28', 'w-16', 'w-24']

/**
 * The catalogue, and the category pages under it.
 *
 * Twelve cards rather than a handful: the grid is four wide on a laptop, so
 * fewer than twelve leaves an obviously short page that then grows, which is
 * the jump a skeleton exists to prevent. On a phone the extra cards are simply
 * below the fold and cost nothing.
 */
export default function Loading() {
  return (
    <SkeletonScreen label="Loading products">
      <div className="border-b border-rule bg-paper-sunk">
        <div className="mx-auto max-w-[86rem] px-gutter py-12">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-5 h-12 w-2/3 max-w-xl" />
          {/* The search box. */}
          <Skeleton className="mt-8 h-12 w-full max-w-lg" />
        </div>
      </div>

      <div className="mx-auto max-w-[86rem] px-gutter py-section">
        <div className="mb-8 flex flex-wrap gap-3">
          {/* Keyed by position, not by the class: two chips share `w-24`. */}
          {RAIL.map((width, index) => (
            <Skeleton key={index} className={`h-8 ${width}`} />
          ))}
        </div>
        <SkeletonProductGrid count={12} />
      </div>
    </SkeletonScreen>
  )
}
