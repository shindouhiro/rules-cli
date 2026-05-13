/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './src/ui/**/*.{vue,js,ts,jsx,tsx,html}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef8ff',
          100: '#d8eeff',
          500: '#0088ff',
          600: '#006add',
          900: '#002f68',
        },
      },
    },
  },
  plugins: [],
}
