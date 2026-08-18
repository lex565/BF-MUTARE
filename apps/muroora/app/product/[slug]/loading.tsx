import { Skeleton, SkeletonScreen, SkeletonText } from '@/app/components/Skeleton'

/**
 * One product.
 *
 * Two columns on a laptop, stacked on a phone, matching the page. The image
 * block is square and holds its own aspect ratio, so the price and the add
 * button do not slide down the screen when the photograph finally decodes -
 * which on a slow connection is the last thing to arrive and the thing people
 * are already reaching for.
 */
export default function Loading() {
  return (
    <SkeletonScreen label="Loading product">
      <div className="mx-auto max-w-[86rem] px-gutter py-12">
        {/* Breadcrumb. */}
        <Skeleton className="h-3 w-56" />

        <div className="mt-10 grid gap-12 lg:grid-cols-2">
          <Skeleton className="aspect-square w-full" />

          <div>
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-5 h-10 w-4/5" />
            <Skeleton className="mt-6 h-8 w-32" />
            <SkeletonText lines={4} className="mt-8" />
            <Skeleton className="mt-10 h-14 w-full max-w-xs" />
            <Skeleton className="mt-4 h-3 w-40" />
          </div>
        </div>
      </div>
    </SkeletonScreen>
  )
}
