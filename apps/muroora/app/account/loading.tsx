import { Skeleton, SkeletonScreen, SkeletonText } from '@/app/components/Skeleton'

/**
 * The account page: a greeting, then a stack of cards for orders, addresses
 * and whatever staff or rider tools this person happens to hold.
 *
 * Three cards is the common case for a customer. Somebody with more roles sees
 * more arrive, which grows the page downwards and disturbs nothing already
 * read.
 */
export default function Loading() {
  return (
    <SkeletonScreen label="Loading your account">
      <div className="mx-auto max-w-[52rem] px-gutter py-16">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-5 h-10 w-2/3" />
        <SkeletonText lines={2} className="mt-6" />

        <div className="mt-12 space-y-4">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="border border-rule bg-paper p-6">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-3 h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonScreen>
  )
}
