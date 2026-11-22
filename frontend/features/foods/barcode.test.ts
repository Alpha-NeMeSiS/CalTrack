import { describe, expect, it } from 'vitest';
import { cleanBarcodeInput, isValidGtin } from './barcode';

describe('isValidGtin', () => {
  it('accepte les codes dont la clé de contrôle est juste', () => {
    expect(isValidGtin('3017620422003')).toBe(true); // EAN-13
    expect(isValidGtin('96385074')).toBe(true); // EAN-8
    expect(isValidGtin('012000161155')).toBe(true); // UPC-A
    expect(isValidGtin('10012345678902')).toBe(true); // GTIN-14
  });

  it('refuse une clé fausse, une mauvaise longueur ou des lettres', () => {
    expect(isValidGtin('3017620422004')).toBe(false);
    expect(isValidGtin('301762042200')).toBe(false);
    expect(isValidGtin('1234567')).toBe(false);
    expect(isValidGtin('123456789')).toBe(false);
    expect(isValidGtin('30176204220a3')).toBe(false);
    expect(isValidGtin('')).toBe(false);
  });
});

describe('cleanBarcodeInput', () => {
  it('retire les espaces et tirets saisis à la main', () => {
    expect(cleanBarcodeInput(' 3 017620 422003 ')).toBe('3017620422003');
    expect(cleanBarcodeInput('3017-6204-22003')).toBe('3017620422003');
  });
});
