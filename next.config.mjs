import { imageHosts } from './image-hosts.config.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: true,
  distDir: process.env.DIST_DIR || '.next',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: imageHosts,
    minimumCacheTTL: 60,
  },

  webpack(config) {
    // Removed @dhiwise/component-tagger loader which requires an ESM-only
    // dependency (chalk) via require() causing runtime errors in Next.js dev.
    // If you need this loader, re-enable it after the package is updated
    // to be compatible with CommonJS or switch to a dynamic import in the
    // loader implementation.
    return config;
  },
};
export default nextConfig;