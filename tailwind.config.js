/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': 'rgba(26, 26, 26, 0.6)',
        'bg-secondary': 'rgba(34, 34, 34, 0.75)',
        'surface': '#1f1f1f',
        'card-active': '#2b2b2b',
        'button-text': '#000000',

        'text-primary': '#e8eaed',
        'text-secondary': '#9e9e9e',
        'accent': '#ffffff',

        'border-color': '#4a4a4a',
        'hover-color': '#ffffff',
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'shiny': '0 0 24px rgba(255, 255, 255, 0.12)',
      },
      borderRadius: {
        'md': '8px',
        'lg': '15px',
      }
    },
  },
  plugins: [],
}