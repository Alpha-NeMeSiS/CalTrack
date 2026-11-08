// Palettes de couleurs de CalTrack, en clair et en sombre.
//
// Les composants utilisent des classes Tailwind classiques (bg-white,
// text-gray-900, bg-blue-50…). Pour le thème sombre, chaque couleur passe par
// une variable CSS (« --c-gray-900 ») dont la valeur change sous la classe
// `.dark` (posée sur <html>) : aucun composant n'a besoin de variantes `dark:`.
//
// Règle du thème sombre : les nuances sont inversées (50 ↔ 950, 100 ↔ 900…),
// ce qui conserve les contrastes (texte foncé sur fond clair → texte clair sur
// fond foncé). « white » (fonds des cartes, texte des boutons) devient le gris
// des surfaces sombres. Les couleurs de la marque sont ajustées à la main.
import defaultColors from 'tailwindcss/colors';

const SCALES = ['gray', 'blue', 'red', 'green', 'amber', 'yellow', 'orange', 'emerald'];

const KAIZEN_LIGHT = {
  50: '#f3fbf8', 100: '#e6f7ef', 200: '#bfeedd', 300: '#99e5cc', 400: '#4fd3ad',
  500: '#19b887', 600: '#158f6f', 700: '#106a53', 800: '#0b493a', 900: '#05261e',
};
const KAIZEN_DARK = {
  50: '#0a1f19', 100: '#0d2a21', 200: '#11402f', 300: '#16634a', 400: '#18946c',
  500: '#1fc192', 600: '#3dd3a6', 700: '#7ae3c2', 800: '#b5f0dc', 900: '#e6f7ef',
};
const SHONEN_LIGHT = { 50: '#fff8f5', 100: '#ffece1', 300: '#ffb185', 500: '#ff6b35', 700: '#cc4f28' };
const SHONEN_DARK = { 50: '#2a160d', 100: '#3b1d10', 300: '#c2562d', 500: '#ff7f4f', 700: '#ffab80' };

/** « #19b887 » → « 25 184 135 » (format attendu par rgb(var() / alpha)) */
function toRgb(hex) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)).join(' ');
}

/** Échelle inversée : 50 ↔ 950, 100 ↔ 900… */
function invert(scale) {
  const keys = Object.keys(scale);
  return Object.fromEntries(keys.map((key, i) => [key, scale[keys[keys.length - 1 - i]]]));
}

function buildPalettes() {
  const light = {};
  const dark = {};
  for (const name of SCALES) {
    light[name] = defaultColors[name];
    dark[name] = invert(defaultColors[name]);
  }
  // Gris moyen un peu plus clair en sombre : texte secondaire lisible sur fond foncé
  dark.gray = { ...dark.gray, 500: defaultColors.gray[400] };
  light.kaizen = KAIZEN_LIGHT;
  dark.kaizen = KAIZEN_DARK;
  light.shonen = SHONEN_LIGHT;
  dark.shonen = SHONEN_DARK;
  light.white = '#ffffff';
  dark.white = '#111827'; // surfaces (cartes) et texte des boutons colorés
  return { light, dark };
}

export const palettes = buildPalettes();

/** Variables CSS d'un thème : { '--c-gray-50': '249 250 251', … } */
export function cssVariables(theme) {
  const vars = {};
  for (const [name, value] of Object.entries(theme)) {
    if (typeof value === 'string') {
      vars[`--c-${name}`] = toRgb(value);
    } else {
      for (const [shade, hex] of Object.entries(value)) vars[`--c-${name}-${shade}`] = toRgb(hex);
    }
  }
  return vars;
}

/** Couleurs Tailwind qui lisent les variables (les modificateurs /50 restent possibles) */
export function tailwindColors() {
  const colors = {};
  for (const [name, value] of Object.entries(palettes.light)) {
    if (typeof value === 'string') {
      colors[name] = `rgb(var(--c-${name}) / <alpha-value>)`;
    } else {
      colors[name] = Object.fromEntries(
        Object.keys(value).map((shade) => [shade, `rgb(var(--c-${name}-${shade}) / <alpha-value>)`])
      );
    }
  }
  return colors;
}
