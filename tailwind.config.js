/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#060606',
          mid: '#0e0e0e',
          up: '#161616'
        },
        accent: {
          DEFAULT: '#f04a0e',
          light: '#ff6122',
          dark: '#b83a0b',
          subtle: 'rgba(240,74,14,0.12)'
        },
        cold: '#b8ccda',
        muted: '#848484',
        success: '#34d399',
        warning: '#fbbf24',
        danger: '#f87171',
        cream: '#ede8df'
      },
      fontFamily: {
        heading: ['"Barlow Condensed"', 'sans-serif'],
        display: ['"Bebas Neue"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif']
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-accent': 'pulseAccent 2s infinite'
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        pulseAccent: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.6' } }
      },
      screens: {
        desktop: '900px'
      }
    }
  },
  plugins: []
};
