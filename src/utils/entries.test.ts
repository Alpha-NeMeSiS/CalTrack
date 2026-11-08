import { describe, expect, it } from 'vitest';
import { buildCopiedEntries, groupEntriesByMeal, parseServingGrams, scaleEntry } from './entries';
import { makeEntry } from '../test/fixtures';

describe('journal — fonctions pures', () => {
  it('regroupe par repas dans l’ordre de la journée avec sous-totaux', () => {
    const groups = groupEntriesByMeal([
      makeEntry({ id: '1', meal_type: 'dinner', kcal: 600 }),
      makeEntry({ id: '2', meal_type: 'breakfast', kcal: 300.4 }),
      makeEntry({ id: '3', meal_type: undefined, kcal: 100 }),
      makeEntry({ id: '4', meal_type: 'breakfast', kcal: 120 }),
    ]);
    expect(groups.map((g) => [g.label, g.entries.length, g.kcal])).toEqual([
      ['Petit-déjeuner', 2, 420],
      ['Dîner', 1, 600],
      ['Sans repas', 1, 100],
    ]);
  });

  it('recalcule les nutriments proportionnellement à la quantité', () => {
    const entry = makeEntry({ qty_grammes: 150, kcal: 247.5, protein_g: 46.5, fat_g: 5.4, carbs_g: 0, fiber_g: 0 });
    expect(scaleEntry(entry, 200)).toEqual({ qty_grammes: 200, kcal: 330, protein_g: 62, fat_g: 7.2, carbs_g: 0, fiber_g: 0 });
    expect(scaleEntry({ ...entry, qty_grammes: 0 }, 100).kcal).toBe(0);
  });

  it('prépare la copie des entrées vers une autre date', () => {
    const [copy] = buildCopiedEntries([makeEntry({ id: 'src', date: '2025-01-09', meal_type: 'lunch' })], 'user-1', '2025-01-10');
    expect(copy).toMatchObject({ user_id: 'user-1', date: '2025-01-10', label: 'Poulet rôti', meal_type: 'lunch' });
    expect(copy).not.toHaveProperty('id');
    expect(copy).not.toHaveProperty('created_at');
  });

  it.each([
    ['125 g', 125],
    ['1 pot (125 g)', 125],
    ['30g', 30],
    ['2 biscuits (25,5 g)', 25.5],
    ['250 ml', null],
    ['', null],
    [undefined, null],
  ])('lit la portion « %s » → %s', (input, expected) => {
    expect(parseServingGrams(input)).toBe(expected);
  });
});
