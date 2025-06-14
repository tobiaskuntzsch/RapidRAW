/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Based on your 'dark-gold' theme
        'bg-primary': '#202020',      // Main background
        'bg-secondary': '#1b1b1b',    // Panel backgrounds (like sidebars)
        'surface': '#201e19',         // Interactive surfaces, inputs, sliders
        'card-active': '#221f1b',     // Hover/active state for cards

        'text-primary': '#f9d5b1',    // Main text color ("beige")
        'text-secondary': '#debe9d',  // Secondary text for labels
        'accent': '#fff7ea',          // Accent color for bold/shiny text ("white")

        'border-color': '#e4a875',    // Borders
        'hover-color': '#e4a875',     // Hover color for specific elements
      },
      fontFamily: {
        // Set Poppins as the default sans-serif font
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // The custom shiny shadow from your old CSS
        'shiny': '0 0 21px rgba(191, 166, 104, 0.5)',
      },
      borderRadius: {
        'md': '10px',
        'lg': '20px',
      }
    },
  },
  plugins: [],
}