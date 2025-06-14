/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Professional dark theme with muted green-gray tones
        'bg-primary': '#1a1d1b',      // Deep charcoal with greenish undertone
        'bg-secondary': '#202322',    // Slightly lighter panel background
        'surface': '#2a2e2c',         // Interactive surfaces
        'card-active': '#323733',     // Card hover/active state

        'text-primary': '#e3e5e1',    // Off-white with a cool-neutral balance
        'text-secondary': '#9ba59c',  // Muted sage-gray for secondary text
        'accent': '#8fbfa7',          // Muted green (sage/seafoam) for highlights

        'border-color': '#5f6a64',    // Mid-gray-green border
        'hover-color': '#a2d2bb',     // Soft minty hover tone for subtle interaction
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'shiny': '0 0 21px rgba(162, 210, 187, 0.25)', // Gentle green glow
      },
      borderRadius: {
        'md': '10px',
        'lg': '20px',
      }
    },
  },
  plugins: [],
}
