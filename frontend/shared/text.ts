// Normalisation de texte pour les recherches (fonctions pures).

/** Texte normalisé pour la recherche : minuscules, sans accents ni ponctuation. */
export const foldSearchText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/ø/g, 'o')
    .replace(/\ufffd/g, '?')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9?]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
