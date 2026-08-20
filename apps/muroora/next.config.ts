import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The shared design-system package ships raw TSX, so Next has to compile it.
  transpilePackages: ['@pineberry/ui'],

  experimental: {
    /**
     * NOTE: `serverActions` still lives under `experimental` in this Next
     * version - config.js reads `result.experimental.serverActions`. Declaring
     * it at the top level type-checks as an unknown property and is silently
     * ignored, which would have left the 1 MB limit in place while looking
     * fixed.
     */
    serverActions: {
    /**
     * Verification photos come through a server action, and Next's default
     * limit is 1 MB.
     *
     * THIS WAS A REAL BUG, not a precaution. A photo of an ID taken on any
     * phone is 2-4 MB, so Next rejected the request with a 413 BEFORE
     * lib/platform/documents.ts - which allows 8 MB - ever saw it. The person
     * uploading got a failed request with no useful message, the requirement
     * never ticked off, and the Submit button therefore stayed disabled
     * forever. The application could not be finished at all.
     *
     * 12 MB rather than 8: multipart encoding adds overhead on top of the file,
     * so a limit equal to the file limit rejects files that are inside it. The
     * real ceiling stays the 8 MB check in documents.ts, which refuses with a
     * sentence somebody can act on.
     *
     * Photos are also downscaled in the browser before they are sent - see the
     * Upload component - so most uploads are a few hundred KB. This is the
     * safety net for the ones that are not, such as PDFs and HEIC files the
     * browser cannot re-encode.
     */
      bodySizeLimit: '12mb',
    },
  },

  images: {
    /**
     * The hero is the one image on the site that is looked at rather than
     * glanced past, and it carries text over it. Next 16 refuses any quality
     * not listed here, so 90 is declared explicitly; 75 stays the default for
     * everything else, including product photos where it is plenty.
     */
    qualities: [75, 90],
    formats: ['image/avif', 'image/webp'],

    /**
     * EVERY PRODUCT PHOTO ON THE SITE WAS A BROKEN IMAGE UNTIL THIS EXISTED.
     *
     * Product photos live in the public `product-photos` bucket on Supabase,
     * so their src is an absolute URL on another host. `next/image` will only
     * optimise a remote host that is listed here, and with nothing listed it
     * refuses every one of them.
     *
     * The failure is quiet in exactly the wrong way. The page renders 200, the
     * `<img>` tag is emitted with the right alt text and the right dimensions,
     * and the browser then requests
     *
     *   /_next/image?url=https%3A%2F%2F<project>.supabase.co%2F...&w=640&q=75
     *
     * which answers `400 INVALID_IMAGE_OPTIMIZE_REQUEST`. So the markup looks
     * correct in the HTML, the server logs look clean, and the customer sees a
     * blank box. Verified against production on 2026-08-20 with the one real
     * product on the marketplace.
     *
     * Scoped to the bucket path rather than the whole host: this project's
     * Supabase domain also serves `business-verification`, which holds
     * photographs of people's national IDs. Those are fetched through 60-second
     * signed links by a reviewer, and they must never be reachable through an
     * image proxy that caches what it fetches. A pathname of `/**` here would
     * have made the optimiser willing to fetch and cache one.
     */
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'dparkquflsqimuvufeyk.supabase.co',
        pathname: '/storage/v1/object/public/product-photos/**',
      },
      {
        protocol: 'https',
        hostname: 'dparkquflsqimuvufeyk.supabase.co',
        pathname: '/storage/v1/object/public/business-logos/**',
      },
    ],
  },
}

export default nextConfig
