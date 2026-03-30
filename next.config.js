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
};

module.exports = nextConfig;
