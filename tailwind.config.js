/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: {
          950: '#06060a',
          900: '#0a0a11',
          850: '#0d0d15',
          800: '#11111b',
          750: '#151521',
          700: '#1b1b2a',
          600: '#252536',
          500: '#323247',
        },
        brand: {
          50: '#f3efff',
          100: '#e5dcff',
          200: '#cdbcff',
          300: '#ae93ff',
          400: '#9570ff',
          500: '#8b5cf6',
          600: '#7644e8',
          700: '#6433c9',
          800: '#512ba3',
          900: '#422683',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(139, 92, 246, 0.25), 0 18px 50px -20px rgba(139, 92, 246, 0.45)',
        panel: '0 24px 80px -32px rgba(0, 0, 0, 0.9)',
        'inner-line': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.06)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(120deg, #8b5cf6 0%, #6366f1 45%, #22d3ee 100%)',
        'brand-gradient-soft': 'linear-gradient(120deg, rgba(139,92,246,.18) 0%, rgba(34,211,238,.10) 100%)',
        'grid-fade':
          'linear-gradient(to right, rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.045) 1px, transparent 1px)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(18px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.45' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up .5s cubic-bezier(.22,1,.36,1) both',
        'fade-in': 'fade-in .35s ease both',
        'scale-in': 'scale-in .25s cubic-bezier(.22,1,.36,1) both',
        'slide-in-right': 'slide-in-right .3s cubic-bezier(.22,1,.36,1) both',
        'pulse-soft': 'pulse-soft 2.2s ease-in-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
        float: 'float 7s ease-in-out infinite',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(.22,1,.36,1)',
      },
    },
  },
  plugins: [],
}
