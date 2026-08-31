import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0a0a0b",
          900: "#111113",
          800: "#1a1a1d",
          700: "#26262b",
          600: "#3a3a41",
          400: "#8b8b95",
          200: "#d4d4d8",
        },
        accent: {
          DEFAULT: "#f5c518",
          dim: "#8a6f0d",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
