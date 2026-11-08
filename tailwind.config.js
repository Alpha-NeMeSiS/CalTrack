import plugin from 'tailwindcss/plugin';
import { cssVariables, palettes, tailwindColors } from './theme.palette.js';

/** @type {import('tailwindcss').Config} */
export default {
  // Thème sombre : classe « dark » posée sur <html> (voir src/utils/theme.ts)
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Couleurs par rôle, en clair et en sombre (voir theme.palette.js)
      colors: tailwindColors(),
      fontFamily: {
        sans: ['Inter', 'Noto Sans JP', 'ui-sans-serif', 'system-ui'],
        // Police du logo uniquement
        display: ['Bangers', 'Noto Sans JP', 'system-ui'],
      },
      boxShadow: {
        // Ombre douce des cartes (panel)
        card: '0 1px 2px rgb(16 24 40 / 0.04), 0 2px 8px rgb(16 24 40 / 0.05)',
      },
    },
  },
  plugins: [
    // Valeurs des variables de couleur pour chaque thème
    plugin(({ addBase }) => {
      addBase({
        ':root': cssVariables(palettes.light),
        '.dark': cssVariables(palettes.dark),
      });
    }),
  ],
};
