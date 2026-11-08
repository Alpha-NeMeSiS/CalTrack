import plugin from 'tailwindcss/plugin';
import { cssVariables, palettes, tailwindColors } from './theme.palette.js';

/** @type {import('tailwindcss').Config} */
export default {
  // Thème sombre : classe « dark » posée sur <html> (voir src/utils/theme.ts)
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palettes clair / sombre via variables CSS (voir theme.palette.js)
        ...tailwindColors(),
        // Bordure translucide des cartes de macros
        kaizen: { ...tailwindColors().kaizen, 1000: 'var(--c-kaizen-1000)' },
        accent: 'rgb(var(--c-shonen-500) / <alpha-value>)',
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
  plugins: [
    // Valeurs des variables de couleur pour chaque thème
    plugin(({ addBase }) => {
      addBase({
        ':root': { ...cssVariables(palettes.light), '--c-kaizen-1000': 'rgba(29, 29, 29, 0.55)' },
        '.dark': { ...cssVariables(palettes.dark), '--c-kaizen-1000': 'rgba(255, 255, 255, 0.16)' },
      });
    }),
  ],
};
