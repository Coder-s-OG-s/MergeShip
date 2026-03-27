/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          purple: "#7C3AED",
          "purple-light": "#A78BFA",
          "purple-dark": "#5B21B6",
          cyan: "#06B6D4",
          "cyan-light": "#67E8F9",
          pink: "#EC4899",
          green: "#10B981",
          amber: "#F59E0B",
          red: "#EF4444",
        },
        dark: {
          900: "#060611",
          800: "#0D0D1A",
          700: "#12122B",
          600: "#1A1A35",
          500: "#222245",
          400: "#2D2D5A",
          300: "#3D3D70",
        },
      },
      fontFamily: {
        display: ["Outfit", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "hero-glow": "radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.3) 0%, transparent 70%)",
        "card-glow": "linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(6,182,212,0.05) 100%)",
      },
      boxShadow: {
        "glow-purple": "0 0 20px rgba(124,58,237,0.4), 0 0 40px rgba(124,58,237,0.2)",
        "glow-cyan": "0 0 20px rgba(6,182,212,0.4), 0 0 40px rgba(6,182,212,0.2)",
        "card": "0 4px 24px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.3)",
        "card-hover": "0 8px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(124,58,237,0.3)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 6s ease-in-out infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
        "slide-in": "slideIn 0.3s ease-out",
        "fade-in": "fadeIn 0.4s ease-out",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        glow: {
          from: { boxShadow: "0 0 10px rgba(124,58,237,0.3)" },
          to: { boxShadow: "0 0 25px rgba(124,58,237,0.6), 0 0 50px rgba(124,58,237,0.3)" },
        },
        slideIn: {
          from: { transform: "translateX(-10px)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
