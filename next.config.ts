import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  assetPrefix: process.env.NODE_ENV === 'production' ? './' : undefined,
  // Disable Next.js dev toolbar (the "N" icon that appears in the widget)
  devIndicators: false,
};

export default nextConfig;
