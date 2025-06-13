/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Base background colors
        'bg-primary': '#1d1d1f',   // Main background, like macOS windows
        'bg-secondary': '#2c2c2e', // Secondary panels, slightly lighter
        'surface': '#3a3a3c',      // For interactive surfaces like sliders
        
        // Text colors
        'text-primary': '#f5f5f7', // Primary text, slightly off-white
        'text-secondary': '#a1a1a6',// Secondary text, for labels or less important info
        
        // Accent and border colors
        'accent': '#0a84ff',       // The classic Apple blue for buttons and highlights
        'accent-hover': '#3b9bff',
        'border-color': '#424245', // Subtle borders between elements
      },
      fontFamily: {
        // Use the system's default modern UI font (San Francisco on macOS, Segoe UI on Windows)
        sans: ['system-ui', 'sans-serif'],
      },
      borderRadius: {
        'large': '12px', // Apple uses more pronounced rounded corners
      }
    },
  },
  plugins: [],
}