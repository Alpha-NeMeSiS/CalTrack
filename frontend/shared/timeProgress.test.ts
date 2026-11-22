import { describe, expect, it } from 'vitest';
import {
  addWeeks,
  clamp,
  computeTimeProgress,
  formatDateFR,
  humanizeRemaining,
  humanizeRemainingDays,
  remainingDays,
  remainingDaysFromStart,
  weeksBetween,
} from './timeProgress';

const start = new Date(2025, 0, 1);
const end = new Date(2025, 0, 29); // 4 semaines

describe('clamp / weeksBetween / addWeeks', () => {
  it('borne une valeur', () => {
    expect(clamp(-5)).toBe(0);
    expect(clamp(150)).toBe(100);
    expect(clamp(5, 10, 20)).toBe(10);
  });

  it('compte les semaines entre deux dates', () => {
    expect(weeksBetween(start, end)).toBe(4);
  });

  it('ajoute des semaines sans modifier la date source', () => {
    const result = addWeeks(start, 2);
    expect(result.getDate()).toBe(15);
    expect(start.getDate()).toBe(1);
  });
});

describe('computeTimeProgress', () => {
  it('calcule le pourcentage à mi-parcours', () => {
    const progress = computeTimeProgress(start, end, new Date(2025, 0, 15));
    expect(progress.percent).toBe(50);
    expect(progress.elapsedWeeks).toBe(2);
    expect(progress.totalWeeks).toBe(4);
    expect(progress.elapsedDays).toBe(14);
  });

  it('plafonne à 100 % après la fin', () => {
    const progress = computeTimeProgress(start, end, new Date(2025, 2, 1));
    expect(progress.percent).toBe(100);
    expect(progress.elapsedWeeks).toBe(4);
  });

  it('reste à 0 % avant le début', () => {
    expect(computeTimeProgress(start, end, new Date(2024, 11, 25)).percent).toBe(0);
  });
});

describe('jours restants', () => {
  const now = new Date(2025, 0, 20);

  it('remainingDays ne devient jamais négatif', () => {
    expect(remainingDays(now, end)).toBe(9);
    expect(remainingDays(new Date(2025, 1, 10), end)).toBe(0);
  });

  it('remainingDaysFromStart compte en jours entiers', () => {
    expect(remainingDaysFromStart(start, now, end)).toBe(9);
    expect(remainingDaysFromStart(undefined, now, end)).toBe(9);
  });

  it('humanizeRemaining passe en semaines au-delà de 7 jours', () => {
    expect(humanizeRemaining(new Date(2025, 0, 27), end)).toBe('2 jours');
    expect(humanizeRemaining(start, end)).toBe('4 semaines');
    expect(humanizeRemaining(new Date(2025, 2, 1), end)).toBe('0 jour');
  });

  it('humanizeRemainingDays accorde le pluriel', () => {
    expect(humanizeRemainingDays(new Date(2025, 0, 28), end, start)).toBe('1 jour');
    expect(humanizeRemainingDays(now, end, start)).toBe('9 jours');
  });
});

describe('formatDateFR', () => {
  it('formate en français', () => {
    expect(formatDateFR(new Date(2025, 0, 15))).toBe('15 janvier 2025');
  });
});
