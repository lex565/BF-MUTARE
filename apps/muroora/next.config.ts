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
  },
}

export default nextConfig
