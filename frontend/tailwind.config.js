/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      colors: {
        glass: {
          50: "rgba(255, 255, 255, 0.9)",
          100: "rgba(255, 255, 255, 0.8)",
          200: "rgba(255, 255, 255, 0.6)",
          300: "rgba(255, 255, 255, 0.4)",
          400: "rgba(255, 255, 255, 0.3)",
          500: "rgba(255, 255, 255, 0.2)",
        },
        bg: "rgb(var(--bg) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        stroke: "rgb(var(--stroke) / <alpha-value>)",
        text: "rgb(var(--text) / <alpha-value>)",
        "text-muted": "rgb(var(--text-muted) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-light": "rgb(var(--accent-light) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",
        error: "rgb(var(--error) / <alpha-value>)",
      },
      borderRadius: {
        xl2: "1.25rem",
        xl3: "1.5rem",
      },
      backdropBlur: {
        xs: "2px",
        12: "12px",
        16: "16px",
      },
      boxShadow: {
        glass: "0 8px 32px -8px rgba(31, 38, 135, 0.15)",
        "glass-dark": "0 8px 32px -8px rgba(0, 0, 0, 0.3)",
        glow: "0 0 20px rgba(139, 92, 246, 0.3)",
        soft: "0 4px 16px -4px rgba(0, 0, 0, 0.1)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "scale-up": "scaleUp 0.2s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        scaleUp: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
