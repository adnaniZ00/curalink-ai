/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        medical: {
          light: '#e0f2fe', // Light blue background
          primary: '#0ea5e9', // Primary brand color
          dark: '#0369a1', // Dark text/accents
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}