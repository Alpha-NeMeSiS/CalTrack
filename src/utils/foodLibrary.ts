// Bibliothèque d'aliments (fonctions pures) : aliments récents tirés du
// journal, favoris et aliments personnels (« Mes aliments »).
import type { Entry, FavoriteFood, Food } from '../lib/supabase';
import type { NormalizedFood } from '../types/food';
import { foldSearchText } from './text';
import type { MealType } from './entries';

/** Aliment proposé en haut de la recherche (favori ou récent) */
export interface QuickFood {
  /** Libellé normalisé : un même aliment n'apparaît qu'une fois */
  key: string;
  label: string;
  /** Valeurs pour 100 g */
  food: NormalizedFood;
  /** Quantité la plus souvent saisie (g) */
  usualQty: number;
  /** Repas le plus fréquent pour cet aliment */
  usualMeal?: MealType;
  /** Présent si l'aliment est en favori */
  favoriteId?: string;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Clé de regroupement d'un libellé (casse et espaces ignorés). */
export const foodKey = (label: string) => label.trim().toLocaleLowerCase('fr-FR').replace(/\s+/g, ' ');

/** Libellé enregistré dans le journal : marque + nom si la marque est connue. */
export const foodLabel = (food: Pick<NormalizedFood, 'name' | 'brand'>) =>
  food.brand ? `${food.brand} ${food.name}` : food.name;

/** Valeurs nutritionnelles d'une portion (kcal entières, macros au dixième). */
export function nutritionForQuantity(food: NormalizedFood, quantity: number) {
  const ratio = Number.isFinite(quantity) && quantity > 0 ? quantity / 100 : 0;
  return {
    kcal: Math.round(food.kcal_per_100g * ratio),
    protein_g: round1(food.protein_g * ratio),
    fat_g: round1(food.fat_g * ratio),
    carbs_g: round1(food.carbs_g * ratio),
    fiber_g: round1(food.fiber_g * ratio),
  };
}

/** Valeur la plus fréquente ; à égalité, la première rencontrée (la plus récente). */
function mostFrequent<T>(values: T[]): T | undefined {
  const counts = new Map<T, number>();
  let best: T | undefined;
  let bestCount = 0;
  for (const value of values) {
    const count = (counts.get(value) ?? 0) + 1;
    counts.set(value, count);
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  // Recherche du premier élément ayant le compte maximal (le plus récent)
  return values.find((value) => counts.get(value) === bestCount) ?? best;
}

const historyFood = (label: string, per100: Omit<NormalizedFood, 'source' | 'name'>): NormalizedFood => ({
  source: 'history',
  name: label,
  ...per100,
});

/**
 * Aliments récents à partir des dernières entrées du journal (triées de la plus
 * récente à la plus ancienne) : un par libellé, avec les valeurs pour 100 g de
 * la saisie la plus récente, la quantité et le repas habituels.
 */
export function buildRecentFoods(entries: readonly Entry[], limit = 8): QuickFood[] {
  const groups = new Map<string, Entry[]>();
  for (const item of entries) {
    const label = item.label?.trim();
    if (!label || !(Number(item.qty_grammes) > 0)) continue;
    const key = foodKey(label);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  return Array.from(groups.entries())
    .slice(0, limit)
    .map(([key, group]) => {
      const latest = group[0];
      const factor = 100 / Number(latest.qty_grammes);
      const label = latest.label!.trim();
      return {
        key,
        label,
        // Valeurs non arrondies : à la quantité habituelle, on retrouve
        // exactement les valeurs de la dernière saisie
        food: historyFood(label, {
          kcal_per_100g: Number(latest.kcal) * factor,
          protein_g: Number(latest.protein_g) * factor,
          fat_g: Number(latest.fat_g) * factor,
          carbs_g: Number(latest.carbs_g) * factor,
          fiber_g: Number(latest.fiber_g ?? 0) * factor,
        }),
        usualQty: mostFrequent(group.map((item) => Number(item.qty_grammes))) ?? 100,
        usualMeal: mostFrequent(group.map((item) => item.meal_type).filter((meal): meal is MealType => Boolean(meal))),
      };
    });
}

/** Favori → aliment rapide */
export function favoriteToQuickFood(favorite: FavoriteFood): QuickFood {
  return {
    key: foodKey(favorite.label),
    label: favorite.label,
    food: historyFood(favorite.label, {
      kcal_per_100g: Number(favorite.kcal_per_100g),
      protein_g: Number(favorite.protein_g),
      fat_g: Number(favorite.fat_g),
      carbs_g: Number(favorite.carbs_g),
      fiber_g: Number(favorite.fiber_g ?? 0),
    }),
    usualQty: Number(favorite.default_qty_g) || 100,
    favoriteId: favorite.id,
  };
}

/** Ligne à insérer dans favorite_foods */
export function buildFavoritePayload(userId: string, food: NormalizedFood, quantity: number) {
  return {
    user_id: userId,
    label: foodLabel(food).trim(),
    kcal_per_100g: round1(food.kcal_per_100g),
    protein_g: round1(food.protein_g),
    fat_g: round1(food.fat_g),
    carbs_g: round1(food.carbs_g),
    fiber_g: round1(food.fiber_g ?? 0),
    default_qty_g: Number.isFinite(quantity) && quantity > 0 ? Math.round(quantity) : 100,
  };
}

/** Aliment personnel → format commun de la recherche */
export function personalFoodToNormalized(food: Food): NormalizedFood {
  return {
    source: 'custom',
    name: food.name,
    foodId: food.id,
    ...(food.barcode ? { barcode: food.barcode } : {}),
    kcal_per_100g: Number(food.kcal_per_100g),
    protein_g: Number(food.protein_g),
    fat_g: Number(food.fat_g),
    carbs_g: Number(food.carbs_g),
    fiber_g: Number(food.fiber_g ?? 0),
  };
}

export interface PortionValues {
  name: string;
  qty_grammes: number;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
}

/**
 * Ligne à insérer dans foods pour un aliment personnel : les valeurs saisies
 * pour une portion sont ramenées à 100 g.
 */
export function buildPersonalFoodPayload(userId: string, values: PortionValues, barcode?: string | null) {
  const factor = values.qty_grammes > 0 ? 100 / values.qty_grammes : 0;
  return {
    user_id: userId,
    name: values.name.trim(),
    kcal_per_100g: round1(values.kcal * factor),
    protein_g: round1(values.protein_g * factor),
    fat_g: round1(values.fat_g * factor),
    carbs_g: round1(values.carbs_g * factor),
    fiber_g: round1((values.fiber_g || 0) * factor),
    barcode: barcode || null,
    is_public: false,
  };
}

/** Aliments personnels dont le nom contient la recherche (sans accents ni majuscules). */
export function searchPersonalFoods(foods: readonly NormalizedFood[], query: string, limit = 5): NormalizedFood[] {
  const needle = foldSearchText(query);
  if (needle.length < 2) return [];
  return foods.filter((food) => foldSearchText(food.name).includes(needle)).slice(0, limit);
}
