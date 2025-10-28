/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        kaizen: {
          50: '#f3fbf8',
          100: '#e6f7ef',
          200: '#bfeedd',
          300: '#99e5cc',
          400: '#4fd3ad',
          500: '#19b887',
          600: '#158f6f',
          700: '#106a53',
          800: '#0b493a',
          900: '#05261e',
          1000: '#1d1d1d8c' 
        },
        shonen: {
          50: '#fff8f5',
          100: '#ffece1',
          300: '#ffb185',
          500: '#ff6b35',
          700: '#cc4f28'
        },
        accent: '#ff6b35'
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans JP', 'ui-sans-serif', 'system-ui'],
        display: ['Bangers', 'Noto Sans JP', 'system-ui']
      },
      keyframes: {
        punch: {
          '0%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-4px) scale(1.02)' },
          '100%': { transform: 'translateY(0) scale(1)' }
        },
        calmPulse: {
          '0%': { opacity: '0.95' },
          '50%': { opacity: '1' },
          '100%': { opacity: '0.95' }
        }
      },
      animation: {
        punch: 'punch 600ms ease-in-out',
        calm: 'calmPulse 3s ease-in-out infinite'
      }
    }
  },
  plugins: [],
};
