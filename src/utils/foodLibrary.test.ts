import { describe, expect, it } from 'vitest';
import type { Entry, FavoriteFood, Food } from '../lib/supabase';
import {
  buildFavoritePayload,
  buildPersonalFoodPayload,
  buildRecentFoods,
  favoriteToQuickFood,
  foodKey,
  foodLabel,
  nutritionForQuantity,
  personalFoodToNormalized,
  searchPersonalFoods,
} from './foodLibrary';

let id = 0;
const entry = (label: string | undefined, qty: number, kcal: number, extra: Partial<Entry> = {}): Entry => ({
  id: `e${(id += 1)}`,
  user_id: 'u',
  date: '2026-11-08',
  label,
  qty_grammes: qty,
  kcal,
  protein_g: qty * 0.05,
  fat_g: qty * 0.02,
  carbs_g: qty * 0.1,
  fiber_g: 0,
  created_at: '2026-11-08T08:00:00Z',
  ...extra,
});

describe('foodKey / foodLabel', () => {
  it('regroupe les libellés sans tenir compte de la casse ni des espaces', () => {
    expect(foodKey('  Yaourt   Nature ')).toBe(foodKey('yaourt nature'));
  });

  it('libellé avec la marque, comme dans le journal', () => {
    expect(foodLabel({ name: 'Nutella', brand: 'Ferrero' })).toBe('Ferrero Nutella');
    expect(foodLabel({ name: 'Pomme, crue' })).toBe('Pomme, crue');
  });
});

describe('buildRecentFoods', () => {
  it('un aliment par libellé, du plus récent au plus ancien, avec ses valeurs pour 100 g', () => {
    // Entrées triées de la plus récente à la plus ancienne (comme la requête)
    const recents = buildRecentFoods([
      entry('Banane', 120, 107),
      entry('Yaourt nature', 125, 66),
      entry('banane ', 100, 89),
    ]);

    expect(recents.map((item) => item.label)).toEqual(['Banane', 'Yaourt nature']);
    expect(recents[0].food).toMatchObject({ source: 'history', name: 'Banane' });
    // 107 kcal pour 120 g → 89,2 kcal pour 100 g
    expect(recents[0].food.kcal_per_100g).toBeCloseTo(89.17, 2);
    expect(recents[0].food.protein_g).toBeCloseTo(5);
    // À la quantité habituelle, on retrouve exactement la dernière saisie
    expect(nutritionForQuantity(recents[0].food, 120).kcal).toBe(107);
  });

  it('quantité et repas habituels : les plus fréquents, le plus récent en cas d’égalité', () => {
    const [yaourt] = buildRecentFoods([
      entry('Yaourt nature', 150, 80, { meal_type: 'snack' }),
      entry('Yaourt nature', 125, 66, { meal_type: 'breakfast' }),
      entry('Yaourt nature', 125, 66, { meal_type: 'breakfast' }),
      entry('Yaourt nature', 150, 80, { meal_type: 'snack' }),
      entry('Yaourt nature', 125, 66),
    ]);

    expect(yaourt.usualQty).toBe(125);
    // breakfast et snack : 2 fois chacun, snack est le plus récent
    expect(yaourt.usualMeal).toBe('snack');
  });

  it('ignore les entrées sans nom ou sans quantité et limite le nombre', () => {
    const recents = buildRecentFoods(
      [entry(undefined, 100, 50), entry('Vide', 0, 0), entry('A', 100, 10), entry('B', 100, 10), entry('C', 100, 10)],
      2
    );
    expect(recents.map((item) => item.label)).toEqual(['A', 'B']);
  });
});

describe('favoris', () => {
  const favorite: FavoriteFood = {
    id: 'fav-1',
    user_id: 'u',
    label: 'Yaourt nature',
    kcal_per_100g: 53,
    protein_g: 4.1,
    fat_g: 1.5,
    carbs_g: 5.5,
    fiber_g: 0,
    default_qty_g: 125,
    created_at: '2026-11-01T00:00:00Z',
  };

  it('un favori devient un aliment rapide avec sa quantité habituelle', () => {
    expect(favoriteToQuickFood(favorite)).toMatchObject({
      key: foodKey('Yaourt nature'),
      label: 'Yaourt nature',
      usualQty: 125,
      favoriteId: 'fav-1',
      food: { source: 'history', name: 'Yaourt nature', kcal_per_100g: 53 },
    });
  });

  it('enregistre le libellé, les valeurs pour 100 g arrondies et la quantité', () => {
    expect(
      buildFavoritePayload('u', { source: 'ciqual', name: 'Pomme, crue', kcal_per_100g: 52.37, protein_g: 0.25, fat_g: 0.2, carbs_g: 11.6, fiber_g: 2.4 }, 150)
    ).toEqual({
      user_id: 'u',
      label: 'Pomme, crue',
      kcal_per_100g: 52.4,
      protein_g: 0.3,
      fat_g: 0.2,
      carbs_g: 11.6,
      fiber_g: 2.4,
      default_qty_g: 150,
    });
  });
});

describe('nutritionForQuantity', () => {
  it('calcule les valeurs d’une portion (kcal entières, macros au dixième)', () => {
    expect(
      nutritionForQuantity({ source: 'history', name: 'X', kcal_per_100g: 53, protein_g: 4.1, fat_g: 1.5, carbs_g: 5.5, fiber_g: 0 }, 125)
    ).toEqual({ kcal: 66, protein_g: 5.1, fat_g: 1.9, carbs_g: 6.9, fiber_g: 0 });
  });
});

describe('mes aliments', () => {
  const food: Food = {
    id: 'food-1',
    user_id: 'u',
    name: 'Granola maison',
    kcal_per_100g: 450,
    protein_g: 10,
    fat_g: 18,
    carbs_g: 60,
    fiber_g: 7,
    is_public: false,
    barcode: '3017620422003',
    created_at: '2026-11-01T00:00:00Z',
  };

  it('convertit un aliment personnel pour la recherche', () => {
    expect(personalFoodToNormalized(food)).toEqual({
      source: 'custom',
      name: 'Granola maison',
      foodId: 'food-1',
      barcode: '3017620422003',
      kcal_per_100g: 450,
      protein_g: 10,
      fat_g: 18,
      carbs_g: 60,
      fiber_g: 7,
    });
  });

  it('valeurs saisies pour une portion → valeurs pour 100 g', () => {
    expect(
      buildPersonalFoodPayload('u', { name: '  Galette ', qty_grammes: 40, kcal: 150, protein_g: 3, fat_g: 6, carbs_g: 21, fiber_g: 1.2 }, '3017620422003')
    ).toEqual({
      user_id: 'u',
      name: 'Galette',
      kcal_per_100g: 375,
      protein_g: 7.5,
      fat_g: 15,
      carbs_g: 52.5,
      fiber_g: 3,
      barcode: '3017620422003',
      is_public: false,
    });
  });

  it('recherche sans accents ni majuscules', () => {
    const foods = [personalFoodToNormalized(food), personalFoodToNormalized({ ...food, id: 'f2', name: 'Crème brûlée', barcode: null })];
    expect(searchPersonalFoods(foods, 'creme').map((f) => f.name)).toEqual(['Crème brûlée']);
    expect(searchPersonalFoods(foods, 'GRANO').map((f) => f.name)).toEqual(['Granola maison']);
    expect(searchPersonalFoods(foods, 'g')).toEqual([]);
  });
});
