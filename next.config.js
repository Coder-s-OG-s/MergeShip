/** @type {import('next').NextConfig} */
const nextConfig = {
  // Compress responses for faster transfer
  compress: true,

  // Optimize images automatically
  images: {
    formats: ["image/avif", "image/webp"],
  },

  // Experimental optimizations
  experimental: {
    // Optimizes CSS output (requires critters package, skip if not installed)
    // optimizeCss: true,

    // Scroll position restoration on back navigation
    scrollRestoration: true,
  },

  // Add security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=()' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
