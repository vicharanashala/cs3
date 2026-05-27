/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Geist", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          DEFAULT: "#111827", // Near-black primary
          muted: "#6B7280",   // Gray muted
          light: "#F9FAFB",   // Light background gray
        }
      }
    },
  },
  plugins: [],
}
