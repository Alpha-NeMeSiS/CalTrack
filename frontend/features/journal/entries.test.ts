import { describe, expect, it } from 'vitest';
import { buildCopiedEntries, groupEntriesByMeal, parseServingGrams, scaleEntry, servingUnit, summarizeMeals } from './entries';
import type { Entry } from '../../shared/supabase';
import { makeEntry } from '../../test/fixtures';

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
    // Boissons : 1 ml ≈ 1 g (jus, lait, sodas)
    ['250 ml', 250],
    ['150ml', 150],
    ['20 cl', 200],
    ['33cl', 330],
    ['0,25 l', 250],
    ['1 L', 1000],
    ['1 verre (200 mL)', 200],
    ['1 litre', 1000],
    // Les grammes priment si les deux sont indiqués
    ['1 portion (30 g) 25 ml', 30],
    ['2 lamelles', null],
    ['', null],
    [undefined, null],
  ])('lit la portion « %s » → %s', (input, expected) => {
    expect(parseServingGrams(input)).toBe(expected);
  });

  it.each([
    ['150 ml', 'ml'],
    ['20 cl', 'ml'],
    ['1 L', 'ml'],
    ['1 pot (125 g)', 'g'],
    ['1 portion (30 g) 25 ml', 'g'],
    [undefined, 'g'],
  ])('unité affichée pour la portion « %s » → %s', (input, expected) => {
    expect(servingUnit(input)).toBe(expected);
  });
});

// Fenêtre « Détail par repas » : ce que chaque repas a apporté dans la journée
describe('summarizeMeals', () => {
  const day = [
    makeEntry({ id: 'b1', meal_type: 'breakfast', kcal: 300, protein_g: 10, fat_g: 8, carbs_g: 40, fiber_g: 3 }),
    makeEntry({ id: 'd1', meal_type: 'dinner', kcal: 650, protein_g: 35, fat_g: 22, carbs_g: 70, fiber_g: 7 }),
    makeEntry({ id: 'b2', meal_type: 'breakfast', kcal: 120, protein_g: 8, fat_g: 4, carbs_g: 18, fiber_g: 3 }),
  ];

  it("additionne kcal et macros par repas, dans l'ordre de la journée", () => {
    const { meals } = summarizeMeals(day);
    expect(meals.map((m) => m.meal)).toEqual(['breakfast', 'dinner']);
    expect(meals[0]).toMatchObject({ kcal: 420, protein_g: 18, fat_g: 12, carbs_g: 58, fiber_g: 6 });
  });

  it('calcule la part des kcal de la journée', () => {
    expect(summarizeMeals(day).meals.map((m) => m.sharePct)).toEqual([39, 61]);
  });

  it('donne le total de la journée', () => {
    expect(summarizeMeals(day).total).toEqual({ kcal: 1070, protein_g: 53, fat_g: 34, carbs_g: 128, fiber_g: 13 });
  });

  it("arrondit à l'unité", () => {
    const { meals } = summarizeMeals([makeEntry({ kcal: 100.4, protein_g: 12.6 })]);
    expect(meals[0]).toMatchObject({ kcal: 100, protein_g: 13 });
  });

  it('journée à 0 kcal : part de 0 %, jamais NaN', () => {
    const { meals } = summarizeMeals([
      makeEntry({ id: '1', meal_type: 'breakfast', kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 }),
      makeEntry({ id: '2', meal_type: 'lunch', kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 }),
    ]);
    expect(meals.map((m) => m.sharePct)).toEqual([0, 0]);
  });

  it('accepte des nombres en chaîne et des fibres absentes', () => {
    const entry = { ...makeEntry(), kcal: '250', fiber_g: null } as unknown as Entry;
    expect(summarizeMeals([entry]).meals[0]).toMatchObject({ kcal: 250, fiber_g: 0 });
  });

  it('range les entrées sans repas dans « Sans repas »', () => {
    const { meals } = summarizeMeals([makeEntry({ meal_type: undefined })]);
    expect(meals[0]).toMatchObject({ meal: 'other', label: 'Sans repas' });
  });

  it('utilise les noms de repas personnalisés', () => {
    const { meals } = summarizeMeals([makeEntry({ meal_type: 'breakfast' })], (meal) => (meal === 'breakfast' ? 'Matin' : meal));
    expect(meals[0].label).toBe('Matin');
  });

  it('aucune entrée : aucun repas et un total nul', () => {
    expect(summarizeMeals([])).toEqual({
      meals: [],
      total: { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0 },
    });
  });
});
