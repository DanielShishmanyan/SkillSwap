/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#effaf4', 100: '#dcf3e6', 200: '#bce7cf', 500: '#2f9d68', 600: '#258457', 700: '#216a49' },
        ink: '#17231d', muted: '#68766e', line: '#e2e9e5', canvas: '#f7f9f8',
      },
      fontFamily: { sans: ['Inter', 'Segoe UI', 'sans-serif'] },
    },
  },
  plugins: [],
}
