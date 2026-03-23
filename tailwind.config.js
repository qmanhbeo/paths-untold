/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}", // Adjust this path based on your project structure
  ],
  theme: {
    extend: {
      fontFamily: {
        // Classic Fantasy Vibes
        cinzel: ['Cinzel', 'serif'],
        uncial: ['"Uncial Antiqua"', 'cursive'],
        medieval: ['"MedievalSharp"', 'cursive'],
        macondo: ['"Macondo"', 'cursive'],
        imfell: ['"IM Fell English SC"', 'serif'],

        // High-Energy RPG Aesthetic
        berkshire: ['"Berkshire Swash"', 'cursive'],
        pirata: ['"Pirata One"', 'cursive'],

        // Elvish, Mystical, or Nature-Based Fantasy
        calligraffiti: ['Calligraffiti', 'cursive'],
        almendra: ['"Almendra SC"', 'serif'],

        // In-Game UI
        crimson: ['"Crimson Text"', 'serif'],
        cardo: ['Cardo', 'serif'],
      },
      keyframes: {
        'slide-in-left': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'blur-in': {
          '0%': { opacity: '0.4', filter: 'blur(8px)' },
          '100%': { opacity: '1', filter: 'blur(0px)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        'sparkle-check': {
          '0%': { opacity: 0, transform: 'translate(-50%, -50%) scale(0)' },
          '50%': { opacity: 1, transform: 'translate(-50%, -50%) scale(1.2)' },
          '100%': { opacity: 0, transform: 'translate(-50%, -50%) scale(0)' },
        },
      },
      animation: {
        'slide-in-left': 'slide-in-left 0.3s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.3s ease-out forwards',
        'fade-in-slow': 'fade-in 1.5s ease-out forwards',
        'blur-in': 'blur-in 3s ease-out forwards', // ✨ Add this line
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-slow': 'pulse-slow 2s ease-in-out infinite',
        'sparkle-check': 'sparkle-check 0.6s ease-out',
      },
    },
  },
  plugins: [],
};
