/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: { navy: { 800: '#16213e', 900: '#0f172a' } },
    },
  },
  plugins: [],
};
