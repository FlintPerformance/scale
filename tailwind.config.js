/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0f1117',
          mid: '#181a22',
          up: '#22252f'
        },
        accent: {
          DEFAULT: '#4f8cff',
          light: '#7aadff',
          dark: '#2a6be0',
          subtle: 'rgba(79,140,255,0.12)'
        },
        success: '#34d399',
        warning: '#fbbf24',
        danger: '#f87171',
        cream: '#f0ece4'
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
