import {
  Skeleton,
  SkeletonProductGrid,
  SkeletonScreen,
  SkeletonText,
} from '@/app/components/Skeleton'

/**
 * A storefront inside Musuwo: the shop's banner, then its products.
 *
 * The banner block is tall on purpose. It is the first thing a customer sees
 * of a business they may not know, and letting it arrive at full height rather
 * than growing into it keeps the shop name in the same place from the first
 * frame to the last.
 */
export default function Loading() {
  return (
    <SkeletonScreen label="Loading shop">
      <Skeleton className="h-52 w-full md:h-72" />

      <div className="mx-auto max-w-[86rem] px-gutter py-section">
        <div className="flex flex-wrap items-center gap-5">
          <Skeleton className="size-20" />
          <div className="min-w-56 flex-1">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="mt-3 h-3 w-40" />
          </div>
        </div>

        <SkeletonText lines={2} className="mt-8 max-w-measure" />

        <div className="mt-12">
          <SkeletonProductGrid count={8} />
        </div>
      </div>
    </SkeletonScreen>
  )
}
