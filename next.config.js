/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  optimizeFonts: false,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't resolve these modules on client-side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        dns: false,
        fs: false,
        child_process: false,
      };
    }
    
    // Externalize mysql2 for server-side
    if (isServer) {
      config.externals.push('mysql2');
    }
    
    return config;
  },
  output: 'standalone', // optional; keeps it easy to deploy on Node or Docker
};

module.exports = nextConfig;