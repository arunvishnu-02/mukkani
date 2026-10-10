import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Bill photos and the payment QR are sent through server actions (up to 5 MB each).
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
}

export default nextConfig
