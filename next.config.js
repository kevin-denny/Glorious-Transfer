/** @type {import('next').NextConfig} */
const nextConfig = {
  // ❌ remove output: 'export'
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  // output: 'standalone', // optional; keeps it easy to deploy on Node or Docker
};

module.exports = nextConfig;