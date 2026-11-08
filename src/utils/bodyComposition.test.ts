import { describe, expect, it } from 'vitest';
import type { WeightLog } from '../lib/supabase';
import { compositionChange, compositionPoints, hasComposition, pickComposition } from './bodyComposition';

const log = (date: string, weight: number, extra: Partial<WeightLog> = {}): WeightLog => ({
  id: date,
  user_id: 'u',
  date,
  weight_kg: weight,
  created_at: `${date}T07:00:00Z`,
  ...extra,
});

describe('pickComposition', () => {
  it('ne garde que les mesures renseignées (le reste de la pesée est conservé)', () => {
    expect(pickComposition({ body_fat_pct: 18.5, muscle_mass_kg: undefined, bone_mass_kg: null, body_water_pct: 0 })).toEqual({
      body_fat_pct: 18.5,
    });
    expect(pickComposition({})).toEqual({});
  });

  it('hasComposition : au moins une mesure', () => {
    expect(hasComposition({ visceral_fat_rating: 7 })).toBe(true);
    expect(hasComposition({ body_fat_pct: null })).toBe(false);
  });
});

describe('compositionPoints', () => {
  it('masse maigre et masse grasse de chaque pesée avec composition, par date', () => {
    const points = compositionPoints([
      log('2026-11-08', 79, { muscle_mass_kg: 58.6, bone_mass_kg: 3.1 }),
      log('2026-11-01', 80, { body_fat_pct: 22 }),
      log('2026-10-25', 80.5),
      // Graisse viscérale seule : pas de masse maigre calculable
      log('2026-10-20', 81, { visceral_fat_rating: 9 }),
    ]);

    expect(points).toEqual([
      { date: '2026-11-01', weightKg: 80, leanKg: 62.4, fatKg: 17.6, source: 'body_fat' },
      { date: '2026-11-08', weightKg: 79, leanKg: 61.7, fatKg: 17.3, source: 'muscle_bone' },
    ]);
  });
});

describe('compositionChange', () => {
  it('bilan entre la première et la dernière mesure', () => {
    expect(
      compositionChange([
        { date: '2026-10-01', weightKg: 82, leanKg: 61, fatKg: 21, source: 'body_fat' },
        { date: '2026-11-08', weightKg: 79.6, leanKg: 61.4, fatKg: 18.2, source: 'body_fat' },
      ])
    ).toEqual({ since: '2026-10-01', fatKg: -2.8, leanKg: 0.4 });
  });

  it('rien avec moins de deux mesures', () => {
    expect(compositionChange([])).toBeNull();
    expect(compositionChange([{ date: '2026-11-08', weightKg: 79, leanKg: 61, fatKg: 18, source: 'body_fat' }])).toBeNull();
  });
});
