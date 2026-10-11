import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // `next dev` opened from another device on the network: DEV_ORIGINS=192.168.1.20,my-mac.local
  allowedDevOrigins: process.env.DEV_ORIGINS?.split(',').map((h) => h.trim()).filter(Boolean),
  // Bill photos and the payment QR are sent through server actions (up to 5 MB each).
  // An entry can carry several bill photos in one save.
  experimental: { serverActions: { bodySizeLimit: '6mb' }, proxyClientMaxBodySize: '40mb' },
}

export default nextConfig
