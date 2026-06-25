/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f8ff',
          100: '#ebf1ff',
          200: '#dbe7ff',
          300: '#bfd5ff',
          400: '#93b6ff',
          500: '#5c8aff',
          600: '#476eff',
          700: '#3857eb',
          800: '#2e45c4',
          900: '#283c9c',
          950: '#1c285c',
        }
      }
    },
  },
  plugins: [],
}
