import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],
  experimental: {
    serverActions: {
      bodySizeLimit: '4.5mb',
    },
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
