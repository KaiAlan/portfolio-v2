import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Partial prerendering + the `use cache` directive. The whole data layer
  // in lib/contentful.ts depends on this being on.
  cacheComponents: true,
}

export default nextConfig
