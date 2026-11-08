// Design tokens de CalTrack : couleurs nommées par RÔLE, en clair et en sombre.
//
// Les composants utilisent des classes Tailwind par rôle (`bg-surface`,
// `text-muted`, `border-line`, `bg-primary-600`…), jamais une teinte brute
// (`bg-white`, `text-gray-500`, `bg-blue-600`) : changer le thème ou corriger
// un contraste se fait ici, à un seul endroit. Le guide est dans
// docs/design-system.md ; un test (src/test/designTokens.test.ts) refuse les
// teintes brutes dans le code.
//
// Chaque couleur passe par une variable CSS (« --c-surface ») dont la valeur
// change sous la classe `.dark` (posée sur <html>) : aucun composant n'a besoin
// de variantes `dark:`.
import defaultColors from 'tailwindcss/colors';

/** Échelles complètes (50 → 950), utilisées par les rôles et les graphiques */
const TAILWIND_SCALES = ['gray', 'blue', 'red', 'green', 'amber', 'orange'];

// Vert du logo : couleur de la marque
const BRAND_LIGHT = {
  50: '#f3fbf8', 100: '#e6f7ef', 200: '#bfeedd', 300: '#99e5cc', 400: '#4fd3ad',
  500: '#19b887', 600: '#158f6f', 700: '#106a53', 800: '#0b493a', 900: '#05261e',
};
const BRAND_DARK = {
  50: '#0a1f19', 100: '#0d2a21', 200: '#11402f', 300: '#16634a', 400: '#18946c',
  500: '#1fc192', 600: '#3dd3a6', 700: '#7ae3c2', 800: '#b5f0dc', 900: '#e6f7ef',
};
// Orange : couleur d'accent (titres, onglet actif, éléments à mettre en avant)
const ACCENT_LIGHT = { 50: '#fff8f5', 100: '#ffece1', 300: '#ffb185', 500: '#ff6b35', 700: '#c2481f' };
const ACCENT_DARK = { 50: '#2a160d', 100: '#3b1d10', 300: '#c2562d', 500: '#ff7f4f', 700: '#ffab80' };

/**
 * Familles par rôle : alias d'une échelle. `primary` (actions principales :
 * boutons, liens, focus) est le vert de la marque ; `info` reste bleu pour les
 * messages d'information.
 */
const ROLE_SCALES = {
  primary: 'brand',
  info: 'blue',
  success: 'green',
  warning: 'amber',
  danger: 'red',
};

/**
 * Rôles « simples » (une couleur) : [clair, sombre], résolus à partir des
 * palettes. `p` est la palette du thème (échelles déjà inversées en sombre).
 */
const ROLES = {
  // Fonds
  canvas: (p, dark) => (dark ? p.gray[50] : '#f3f6f5'), // fond des pages (gris-vert très léger en clair)
  surface: (p, dark) => (dark ? '#111827' : '#ffffff'), // cartes, champs, fenêtres
  'surface-muted': (p) => p.gray[50], // zones grisées, survol
  'surface-sunken': (p) => p.gray[100], // fonds en creux (onglets, pistes)
  'surface-strong': (p) => p.gray[200], // pistes de progression, séparateurs pleins
  // Bordures
  'line-subtle': (p) => p.gray[100],
  line: (p) => p.gray[200],
  'line-strong': (p) => p.gray[300], // champs, boutons secondaires
  'line-emphasis': (p) => p.gray[400], // survol des bordures
  // Textes
  ink: (p) => p.gray[900], // titres, valeurs, texte principal
  body: (p) => p.gray[700], // libellés, texte courant
  muted: (p) => p.gray[600], // texte secondaire
  subtle: (p, dark) => (dark ? defaultColors.gray[400] : '#636b78'), // indications discrètes (gris 500 assombri : 4,5:1 sur fonds teintés)
  // Texte posé sur une couleur pleine (boutons, pastilles)
  'on-color': (p, dark) => (dark ? '#111827' : '#ffffff'),
};

/** « #19b887 » → « 25 184 135 » (format attendu par rgb(var() / alpha)) */
function toRgb(hex) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)).join(' ');
}

/** Échelle inversée pour le thème sombre : 50 ↔ 950, 100 ↔ 900… */
function invert(scale) {
  const keys = Object.keys(scale);
  return Object.fromEntries(keys.map((key, i) => [key, scale[keys[keys.length - 1 - i]]]));
}

function buildPalettes() {
  const light = {};
  const dark = {};
  for (const name of TAILWIND_SCALES) {
    light[name] = defaultColors[name];
    dark[name] = invert(defaultColors[name]);
  }
  // Gris moyen un peu plus clair en sombre : texte secondaire lisible sur fond foncé
  dark.gray = { ...dark.gray, 500: defaultColors.gray[400] };
  light.brand = BRAND_LIGHT;
  dark.brand = BRAND_DARK;
  light.accent = ACCENT_LIGHT;
  dark.accent = ACCENT_DARK;
  for (const [role, scale] of Object.entries(ROLE_SCALES)) {
    light[role] = light[scale];
    dark[role] = dark[scale];
  }
  for (const [role, resolve] of Object.entries(ROLES)) {
    light[role] = resolve(light, false);
    dark[role] = resolve(dark, true);
  }
  return { light, dark };
}

export const palettes = buildPalettes();

/** Variables CSS d'un thème : { '--c-gray-50': '249 250 251', '--c-surface': '255 255 255', … } */
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
