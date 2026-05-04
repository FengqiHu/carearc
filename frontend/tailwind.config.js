/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#1d4ed8',
          dark: '#1e40af',
        },
        teal: {
          accent: '#0d9488',
        },
        near: {
          black: '#101114',
        },
        silver: '#9497a9',
        border: '#dedee5',
      },
    },
  },
  plugins: [],
}
