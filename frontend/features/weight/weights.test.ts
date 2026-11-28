import { describe, expect, it } from 'vitest';
import {
  getLatestWeight,
  momentOf,
  movingAverage,
  referenceWeights,
  sortWeights,
  suggestMoment,
  weightChangeSince,
  type WeightPoint,
} from './weights';

const logs = [
  { date: '2025-01-03', weight_kg: 81.4 },
  { date: '2025-01-01', weight_kg: 82 },
  { date: '2025-01-10', weight_kg: 80.2 },
  { date: '2025-01-08', weight_kg: 80.6 },
];

describe('journal de pesées — calculs', () => {
  it('trie par date et écarte les valeurs invalides', () => {
    const sorted = sortWeights([...logs, { date: '2025-01-05', weight_kg: Number.NaN }]);
    expect(sorted.map((p) => p.date)).toEqual(['2025-01-01', '2025-01-03', '2025-01-08', '2025-01-10']);
  });

  it('renvoie la pesée la plus récente', () => {
    expect(getLatestWeight(logs)).toEqual({ date: '2025-01-10', weight_kg: 80.2 });
    expect(getLatestWeight([])).toBeNull();
  });

  it('calcule une moyenne glissante sur 7 jours calendaires', () => {
    const avg = movingAverage(logs, 7);
    expect(avg.map((p) => p.weight_kg)).toEqual([
      82, // 1er : seul
      81.7, // 1er-3 : (82 + 81,4) / 2
      81, // 2-8 : (81,4 + 80,6) / 2
      80.4, // 4-10 : (80,6 + 80,2) / 2
    ]);
  });

  it("mesure l'évolution sur une période (null sans 2 pesées)", () => {
    expect(weightChangeSince(logs, '2025-01-01')).toBe(-1.8);
    expect(weightChangeSince(logs, '2025-01-09')).toBeNull();
  });
});

describe('pesées de référence (matin à jeun)', () => {
  const morning = (date: string, weight_kg: number): WeightPoint => ({ date, weight_kg, moment: 'morning' });
  const later = (date: string, weight_kg: number): WeightPoint => ({ date, weight_kg, moment: 'later' });

  it('une pesée sans moment compte comme une pesée du matin', () => {
    expect(momentOf({})).toBe('morning');
    expect(momentOf({ moment: null })).toBe('morning');
    expect(momentOf({ moment: 'later' })).toBe('later');
  });

  it('écarte la pesée du soir quand une pesée du matin la précède', () => {
    const refs = referenceWeights([later('2026-11-21', 68.1), morning('2026-11-20', 66.1)]);
    expect(refs.map((p) => p.date)).toEqual(['2026-11-20']);
  });

  it('garde une pesée « plus tard » sans pesée du matin dans les 14 jours qui la précèdent', () => {
    expect(referenceWeights([later('2026-11-21', 68.1)])).toHaveLength(1);
    // Pile 14 jours avant : la pesée du matin compte encore
    expect(referenceWeights([morning('2026-11-07', 66), later('2026-11-21', 68.1)]).map((p) => p.date)).toEqual([
      '2026-11-07',
    ]);
    // 15 jours avant : trop ancienne, la pesée « plus tard » sert de repère
    expect(referenceWeights([morning('2026-11-06', 66), later('2026-11-21', 68.1)]).map((p) => p.date)).toEqual([
      '2026-11-06',
      '2026-11-21',
    ]);
  });

  it("garde toutes les pesées de quelqu'un qui ne se pèse que le soir, triées par date", () => {
    const refs = referenceWeights([later('2026-11-22', 68), later('2026-11-20', 68.4), later('2026-11-21', 68.2)]);
    expect(refs.map((p) => p.date)).toEqual(['2026-11-20', '2026-11-21', '2026-11-22']);
  });

  it('garde les anciennes pesées (sans moment)', () => {
    expect(referenceWeights(logs)).toHaveLength(4);
  });

  it("propose le matin avant midi et « plus tard » ensuite, aujourd'hui", () => {
    expect(suggestMoment({ isToday: true, hour: 11 })).toBe('morning');
    expect(suggestMoment({ isToday: true, hour: 12 })).toBe('later');
    // Le soir, même si la pesée du matin existe : l'heure décide
    expect(suggestMoment({ isToday: true, hour: 20, existing: { moment: 'morning' } })).toBe('later');
  });

  it('propose le moment de la pesée existante pour un jour passé, sinon le matin', () => {
    expect(suggestMoment({ isToday: false, hour: 20, existing: { moment: 'later' } })).toBe('later');
    expect(suggestMoment({ isToday: false, hour: 20, existing: {} })).toBe('morning');
    expect(suggestMoment({ isToday: false, hour: 20, existing: null })).toBe('morning');
  });
});
