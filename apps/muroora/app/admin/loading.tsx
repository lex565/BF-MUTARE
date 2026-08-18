import {
  Skeleton,
  SkeletonScreen,
  SkeletonStatRow,
  SkeletonTable,
} from '@/app/components/Skeleton'

/**
 * Every admin screen: products, delivery, riders, staff, reports.
 *
 * They share a shape - a heading, a row of counts, then a table - so one file
 * at the top of the segment covers all of them rather than five near-identical
 * copies that then drift.
 *
 * These are the slowest pages in the app. Each one is `force-dynamic` and runs
 * several queries before it can render anything at all, so this is the
 * skeleton most likely to actually be seen.
 */
export default function Loading() {
  return (
    <SkeletonScreen label="Loading">
      <div className="mx-auto max-w-[86rem] px-gutter py-12">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-5 h-10 w-64" />

        <div className="mt-10">
          <SkeletonStatRow />
        </div>

        <div className="mt-10">
          <SkeletonTable rows={8} columns={5} />
        </div>
      </div>
    </SkeletonScreen>
  )
}
