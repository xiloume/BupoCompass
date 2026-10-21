/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0f0f14',
          800: '#1a1a24',
          700: '#24243a',
        },
      },
    },
  },
  plugins: [],
};
