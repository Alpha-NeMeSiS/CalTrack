import { describe, expect, it } from 'vitest';
import type { WaterLog } from '../lib/supabase';
import {
  autoWaterGoal,
  formatLiters,
  lastWaterLog,
  parseLiters,
  validateWaterAmount,
  validateWaterGoal,
  waterGoal,
  waterProgress,
  waterTotal,
  weeklyWaterSummary,
} from './water';

const log = (date: string, amount_ml: number, created_at = `${date}T10:00:00Z`): WaterLog => ({
  id: `${date}-${amount_ml}-${created_at}`,
  user_id: 'user-1',
  date,
  amount_ml,
  created_at,
});

describe('objectif', () => {
  it('se calcule d’après le poids (30 ml/kg, arrondi aux 100 ml, entre 1,5 et 4 L)', () => {
    expect(autoWaterGoal(79)).toBe(2400);
    expect(autoWaterGoal(40)).toBe(1500);
    expect(autoWaterGoal(150)).toBe(4000);
  });

  it('vaut 2 L sans poids connu', () => {
    expect(autoWaterGoal(null)).toBe(2000);
    expect(autoWaterGoal(undefined)).toBe(2000);
    expect(autoWaterGoal(0)).toBe(2000);
  });

  it('privilégie l’objectif manuel', () => {
    expect(waterGoal(2500, 79)).toBe(2500);
    expect(waterGoal(null, 79)).toBe(2400);
  });
});

describe('journée', () => {
  it('additionne les prises', () => {
    expect(waterTotal([log('2026-11-08', 250), log('2026-11-08', 500), log('2026-11-08', 500)])).toBe(1250);
    expect(waterTotal([])).toBe(0);
  });

  it('calcule la progression, barre plafonnée à 100 %', () => {
    expect(waterProgress(1250, 2400)).toEqual({ percent: 52, barPercent: 52, remainingMl: 1150, reached: false });
    expect(waterProgress(2600, 2400)).toEqual({ percent: 108, barPercent: 100, remainingMl: 0, reached: true });
    expect(waterProgress(2400, 2400).reached).toBe(true);
  });

  it('retrouve la dernière prise', () => {
    const logs = [
      log('2026-11-08', 250, '2026-11-08T08:00:00Z'),
      log('2026-11-08', 500, '2026-11-08T15:30:00Z'),
      log('2026-11-08', 330, '2026-11-08T12:00:00Z'),
    ];
    expect(lastWaterLog(logs)?.amount_ml).toBe(500);
    expect(lastWaterLog([])).toBeUndefined();
  });
});

describe('weeklyWaterSummary', () => {
  it('résume les 7 jours avant aujourd’hui', () => {
    const logs = [
      log('2026-11-08', 3000), // aujourd'hui : exclu
      log('2026-11-07', 2500),
      log('2026-11-06', 2000),
      log('2026-11-06', 500),
      log('2026-11-05', 1800),
      log('2026-11-01', 2400),
      log('2026-10-31', 2000), // J-8 : hors période
    ];
    // Jours notés : 2 500, 2 500, 1 800, 2 400 → moyenne 2 300 ; 3 jours ≥ 2 400
    expect(weeklyWaterSummary(logs, 2400, '2026-11-08')).toEqual({ averageMl: 2300, loggedDays: 4, daysAtGoal: 3 });
  });

  it('arrondit la moyenne aux 50 ml', () => {
    const logs = [log('2026-11-07', 2000), log('2026-11-06', 2130)];
    expect(weeklyWaterSummary(logs, 2400, '2026-11-08').averageMl).toBe(2050);
  });

  it('ne propose pas de moyenne sans prise', () => {
    expect(weeklyWaterSummary([log('2026-11-08', 500)], 2400, '2026-11-08')).toEqual({ averageMl: null, loggedDays: 0, daysAtGoal: 0 });
  });
});

describe('formatage et validation', () => {
  it('écrit les litres à la française', () => {
    expect(formatLiters(500)).toBe('0,5 L');
    expect(formatLiters(1250)).toBe('1,25 L');
    expect(formatLiters(2400)).toBe('2,4 L');
    expect(formatLiters(0)).toBe('0 L');
  });

  it('lit un objectif en litres, avec virgule ou point', () => {
    expect(parseLiters('2,5')).toBe(2500);
    expect(parseLiters(' 1.75 ')).toBe(1750);
    expect(parseLiters('')).toBeNaN();
    expect(parseLiters('beaucoup')).toBeNaN();
  });

  it('borne les quantités et l’objectif', () => {
    expect(validateWaterAmount(250)).toBeNull();
    expect(validateWaterAmount(0)).toBe('Indiquez une quantité entre 1 et 3 000 ml.');
    expect(validateWaterAmount(3001)).toBe('Indiquez une quantité entre 1 et 3 000 ml.');
    expect(validateWaterAmount(12.5)).toBe('Indiquez une quantité entre 1 et 3 000 ml.');
    expect(validateWaterGoal(null)).toBeNull();
    expect(validateWaterGoal(2500)).toBeNull();
    expect(validateWaterGoal(400)).toBe('L’objectif d’eau doit être compris entre 0,5 et 6 L.');
    expect(validateWaterGoal(Number.NaN)).toBe('L’objectif d’eau doit être compris entre 0,5 et 6 L.');
  });
});
