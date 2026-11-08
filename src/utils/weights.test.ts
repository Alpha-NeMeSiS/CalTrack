import { describe, expect, it } from 'vitest';
import { getLatestWeight, movingAverage, sortWeights, weightChangeSince } from './weights';

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
