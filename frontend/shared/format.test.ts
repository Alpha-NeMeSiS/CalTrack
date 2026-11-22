import { describe, expect, it } from 'vitest';
import { formatDecimal, formatKg, formatNumber, formatPercent, formatSigned } from './format';

// Séparateur de milliers français : espace fine insécable
const NNBSP = ' ';

describe('formatNumber', () => {
  it('utilise la virgule et un nombre fixe de décimales', () => {
    expect(formatNumber(1.5, 1)).toBe('1,5');
    expect(formatNumber(2, 2)).toBe('2,00');
    expect(formatNumber(1.26, 1)).toBe('1,3');
    expect(formatNumber(1999.6)).toBe(`2${NNBSP}000`);
  });
});

describe('formatDecimal', () => {
  it('retire les décimales inutiles', () => {
    expect(formatDecimal(80)).toBe('80');
    expect(formatDecimal(80.25)).toBe('80,3');
    expect(formatDecimal(1.234, 2)).toBe('1,23');
  });
});

describe('formatSigned', () => {
  it('affiche + ou le vrai signe moins', () => {
    expect(formatSigned(1.5, 1)).toBe('+1,5');
    expect(formatSigned(-3, 1)).toBe('−3,0');
  });

  it('n’affiche pas de signe pour une valeur arrondie à zéro', () => {
    expect(formatSigned(0)).toBe('0');
    expect(formatSigned(-0.04, 1)).toBe('0,0');
    expect(formatSigned(0.4)).toBe('0');
  });
});

describe('formatKg', () => {
  it('ajoute l’unité, avec une décimale par défaut', () => {
    expect(formatKg(80)).toBe('80,0 kg');
    expect(formatKg(0.25, 2)).toBe('0,25 kg');
  });
});

describe('formatPercent', () => {
  it('suit la typographie française (espace avant %)', () => {
    expect(formatPercent(50)).toBe('50 %');
    expect(formatPercent(12.34, 1)).toBe('12,3 %');
  });
});
