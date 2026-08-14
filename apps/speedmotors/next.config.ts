import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The shared design-system package ships raw TSX, so Next has to compile it.
  transpilePackages: ['@pineberry/ui'],
}

export default nextConfig
