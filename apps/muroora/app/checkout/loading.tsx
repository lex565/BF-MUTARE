import { Skeleton, SkeletonScreen } from '@/app/components/Skeleton'

/**
 * Checkout: the form on the left, the order summary on the right.
 *
 * The summary column is given its real width even while empty. It carries the
 * total, and a total that appears late - after somebody has already started
 * reading the form - is the one number on this site nobody should have to hunt
 * for twice.
 */
export default function Loading() {
  return (
    <SkeletonScreen label="Loading checkout">
      <div className="mx-auto max-w-[86rem] px-gutter py-12">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-5 h-10 w-72" />

        <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_24rem]">
          <div className="space-y-8">
            {Array.from({ length: 3 }, (_, section) => (
              <div key={section}>
                <Skeleton className="h-4 w-44" />
                <div className="mt-5 space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            ))}
          </div>

          <div className="border border-rule bg-paper p-6">
            <Skeleton className="h-4 w-32" />
            <div className="mt-6 space-y-3">
              {Array.from({ length: 4 }, (_, row) => (
                <div key={row} className="flex justify-between gap-4">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3.5 w-14" />
                </div>
              ))}
            </div>
            <Skeleton className="mt-6 h-7 w-28" />
            <Skeleton className="mt-6 h-14 w-full" />
          </div>
        </div>
      </div>
    </SkeletonScreen>
  )
}
