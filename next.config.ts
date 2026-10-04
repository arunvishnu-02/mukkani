import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // `next dev` opened from another device on the network: DEV_ORIGINS=192.168.1.20,my-mac.local
  allowedDevOrigins: process.env.DEV_ORIGINS?.split(',').map((h) => h.trim()).filter(Boolean),
}

export default nextConfig
