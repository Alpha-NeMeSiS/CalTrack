// Contrastes de la palette (WCAG 2.2 AA), calculés directement depuis
// theme.palette.js, en clair et en sombre. Complète le contrôle axe de la CI,
// qui ne sait pas mesurer le texte posé sur un dégradé ni les icônes.
import { describe, expect, it } from 'vitest';
import { palettes, type Theme } from '../../theme.palette.js';

const TEXT = 4.5; // texte courant
const GRAPHIC = 3; // icônes et éléments graphiques (critère 1.4.11)

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** « muted » → couleur simple ; « danger-700 » → nuance d'une échelle */
function color(theme: Theme, token: string) {
  const direct = theme[token];
  if (typeof direct === 'string') return direct;
  const [, name, shade] = token.match(/^(.+)-(\d+)$/) ?? [];
  const scale = theme[name];
  if (!scale || typeof scale === 'string' || !scale[shade]) throw new Error(`Couleur inconnue : ${token}`);
  return scale[shade];
}

const SURFACES = ['surface', 'surface-muted', 'surface-sunken'];
const TINTS = ['info-50', 'success-50', 'warning-50', 'danger-50', 'orange-50'];
const STATUS = ['info', 'success', 'danger', 'orange'];

// [texte, fond, minimum]
const PAIRS: Array<[string, string, number]> = [
  // Texte neutre sur les surfaces et sur les lignes teintées (tendances)
  ...['ink', 'body', 'muted', 'subtle'].flatMap((fg) =>
    [...SURFACES, ...TINTS].map((bg): [string, string, number] => [fg, bg, TEXT])
  ),
  // Titres, liens et onglet actif
  ...SURFACES.map((bg): [string, string, number] => ['accent-700', bg, TEXT]),
  ...SURFACES.map((bg): [string, string, number] => ['brand-700', bg, TEXT]),
  // Statuts et pastilles (texte -700 sur fond -50 / -100)
  ...STATUS.flatMap((s) => ['50', '100'].map((shade): [string, string, number] => [`${s}-700`, `${s}-${shade}`, TEXT])),
  ['warning-800', 'warning-50', TEXT],
  ['muted', 'surface-sunken', TEXT],
  // Fond de page teinté (canvas)
  ...['ink', 'body', 'muted', 'subtle', 'primary-700'].map((fg): [string, string, number] => [fg, 'canvas', TEXT]),
  // Titres de carte, liens verts, pastille « en cours »
  ['brand-800', 'surface', TEXT],
  ['primary-700', 'surface', TEXT],
  ['brand-700', 'brand-50', TEXT],
  // Texte sur couleur pleine : boutons primaire (vert), danger et marque
  ['on-color', 'primary-700', TEXT],
  ['on-color', 'primary-800', TEXT],
  ['on-color', 'danger-600', TEXT],
  ['on-color', 'brand-700', TEXT],
  ['on-color', 'brand-800', TEXT],
  // Graphiques et focus : bouton flottant, anneau de focus, anneau des calories, courbes
  ['on-color', 'brand-600', GRAPHIC],
  ['primary-600', 'surface', GRAPHIC],
  ['brand-600', 'surface', GRAPHIC],
  ['primary-600', 'canvas', GRAPHIC],
];

it('repère un contraste insuffisant (texte blanc sur le vert du logo)', () => {
  expect(contrast('#ffffff', color(palettes.light, 'brand-500'))).toBeLessThan(TEXT);
  expect(contrast('#ffffff', '#000000')).toBeCloseTo(21);
});

describe.each(['light', 'dark'] as const)('contrastes de la palette (%s)', (mode) => {
  const theme = palettes[mode];

  it.each(PAIRS)('%s sur %s ≥ %s:1', (fg, bg, min) => {
    const ratio = contrast(color(theme, fg), color(theme, bg));
    expect(Math.round(ratio * 100) / 100).toBeGreaterThanOrEqual(min);
  });
});
