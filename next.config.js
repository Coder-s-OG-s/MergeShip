/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development';

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
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://va.vercel-scripts.com`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.github.com https://github.com https://*.supabase.co https://vitals.vercel-insights.com http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
