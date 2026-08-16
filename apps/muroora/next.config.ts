import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The shared design-system package ships raw TSX, so Next has to compile it.
  transpilePackages: ['@pineberry/ui'],

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
