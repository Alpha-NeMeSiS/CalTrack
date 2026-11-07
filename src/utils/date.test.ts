import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addDaysToDateString,
  getTodayDate,
  isDateOnlyString,
  parseLocalDate,
  timestampToLocalDateString,
  toLocalDateString,
} from './date';

describe('toLocalDateString', () => {
  it('formate une date en YYYY-MM-DD avec des zéros', () => {
    expect(toLocalDateString(new Date(2025, 0, 5))).toBe('2025-01-05');
    expect(toLocalDateString(new Date(2025, 11, 31))).toBe('2025-12-31');
  });

  it('utilise le jour LOCAL, même juste après minuit (régression UTC)', () => {
    // 00h30 heure locale le 1er janvier : toISOString() donnerait le 31/12 en France
    expect(toLocalDateString(new Date(2025, 0, 1, 0, 30))).toBe('2025-01-01');
    expect(toLocalDateString(new Date(2025, 5, 15, 23, 59))).toBe('2025-06-15');
  });
});

describe('getTodayDate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renvoie la date locale du jour", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 4, 10, 0, 15));
    expect(getTodayDate()).toBe('2025-05-10');
  });
});

describe('parseLocalDate', () => {
  it('interprète YYYY-MM-DD à minuit local (et non UTC)', () => {
    const date = parseLocalDate('2025-03-09');
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(9);
    expect(date.getHours()).toBe(0);
  });

  it('délègue les timestamps complets à new Date()', () => {
    const iso = '2025-03-09T10:20:30.000Z';
    expect(parseLocalDate(iso).getTime()).toBe(new Date(iso).getTime());
  });
});

describe('addDaysToDateString', () => {
  it.each([
    ['2025-01-31', 1, '2025-02-01'],
    ['2025-12-31', 1, '2026-01-01'],
    ['2024-02-28', 1, '2024-02-29'], // année bissextile
    ['2025-03-01', -1, '2025-02-28'],
    ['2025-03-29', 2, '2025-03-31'], // passage à l'heure d'été (Europe)
    ['2025-10-25', 2, '2025-10-27'], // passage à l'heure d'hiver (Europe)
    ['2025-01-10', 0, '2025-01-10'],
  ])('%s + %i jour(s) = %s', (start, days, expected) => {
    expect(addDaysToDateString(start, days)).toBe(expected);
  });
});

describe('isDateOnlyString', () => {
  it('reconnaît uniquement le format YYYY-MM-DD', () => {
    expect(isDateOnlyString('2025-01-10')).toBe(true);
    expect(isDateOnlyString('2025-1-10')).toBe(false);
    expect(isDateOnlyString('2025-01-10T00:00:00Z')).toBe(false);
  });
});

describe('timestampToLocalDateString', () => {
  it('convertit un timestamp en date locale', () => {
    const local = new Date(2025, 6, 14, 22, 45);
    expect(timestampToLocalDateString(local.toISOString())).toBe('2025-07-14');
  });
});
