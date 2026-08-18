import {
  Skeleton,
  SkeletonPageHeader,
  SkeletonScreen,
  SkeletonText,
} from '@/app/components/Skeleton'

/**
 * The fallback skeleton for any route without a closer one.
 *
 * A heading and a column of text, because that is the shape of every page this
 * catches: About, Contact, Diaspora, Riders, Marketplace, the sign-in screens.
 * Routes whose shape is genuinely different - a product grid, an admin table -
 * carry their own `loading.tsx` beside them rather than being approximated
 * here.
 *
 * Nav, StaffBar and Footer come from the layout and are already on screen, so
 * this covers the page body only.
 */
export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonPageHeader />
      <div className="mx-auto max-w-[86rem] px-gutter py-section">
        <div className="max-w-measure">
          <SkeletonText lines={4} />
          <SkeletonText lines={3} className="mt-8" />
          <Skeleton className="mt-10 h-12 w-48" />
        </div>
      </div>
    </SkeletonScreen>
  )
}
