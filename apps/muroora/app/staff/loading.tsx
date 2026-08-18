import { Skeleton, SkeletonScreen } from '@/app/components/Skeleton'

/**
 * The staff area: the dashboard of tiles, plus deliveries, the card and the
 * profile beneath it.
 *
 * Tiles rather than a table, at the same minimum height the real ones use,
 * because the whole tile is the tap target on a phone and a tile that grows
 * under a thumb already moving is how somebody opens the wrong screen
 * mid-shift.
 */
export default function Loading() {
  return (
    <SkeletonScreen label="Loading">
      <div className="mx-auto max-w-[86rem] px-gutter py-12">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-5 h-10 w-72" />
        <Skeleton className="mt-4 h-4 w-56" />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="flex min-h-[7.5rem] flex-col border border-rule p-6"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-auto h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonScreen>
  )
}
