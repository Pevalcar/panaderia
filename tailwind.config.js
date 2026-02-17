/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Clean path for content to match your file structure.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: '#0F172A', // Slate 900
        surface: '#1E293B', // Slate 800
        primary: '#6366F1', // Indigo 500
        secondary: '#EC4899', // Pink 500
        accent: '#8B5CF6', // Violet 500
        text: '#F8FAFC', // Slate 50
        muted: '#94A3B8', // Slate 400
        border: '#334155', // Slate 700
      },
    }
  },
  plugins: [],
}
