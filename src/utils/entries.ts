// Logique du journal alimentaire (fonctions pures, testables).
import type { Entry } from '../lib/supabase';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_ORDER: Array<MealType | 'other'> = ['breakfast', 'lunch', 'dinner', 'snack', 'other'];

export const MEAL_LABELS: Record<MealType | 'other', string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  dinner: 'Dîner',
  snack: 'Collation',
  other: 'Sans repas',
};

export interface MealGroup<T> {
  meal: MealType | 'other';
  label: string;
  entries: T[];
  kcal: number;
}

/**
 * Regroupe les entrées par repas (ordre de la journée), avec le total de calories.
 * `getLabel` permet d'utiliser les noms de repas personnalisés.
 */
export function groupEntriesByMeal<T extends Pick<Entry, 'meal_type' | 'kcal'>>(
  entries: readonly T[],
  getLabel: (meal: MealType | 'other') => string = (meal) => MEAL_LABELS[meal]
): MealGroup<T>[] {
  return MEAL_ORDER.map((meal) => {
    const items = entries.filter((entry) => (entry.meal_type ?? 'other') === meal);
    return {
      meal,
      label: getLabel(meal),
      entries: items,
      kcal: Math.round(items.reduce((sum, entry) => sum + (Number(entry.kcal) || 0), 0)),
    };
  }).filter((group) => group.entries.length > 0);
}

type NutrientFields = Pick<Entry, 'qty_grammes' | 'kcal' | 'protein_g' | 'fat_g' | 'carbs_g' | 'fiber_g'>;

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Valeurs d'une entrée pour une nouvelle quantité : les nutriments sont
 * proportionnels à la quantité (l'entrée ne stocke pas les valeurs pour 100 g).
 */
export function scaleEntry(entry: NutrientFields, newQuantity: number): NutrientFields {
  const base = Number(entry.qty_grammes);
  const ratio = base > 0 ? newQuantity / base : 0;
  return {
    qty_grammes: newQuantity,
    kcal: Math.round(Number(entry.kcal) * ratio),
    protein_g: round1(Number(entry.protein_g) * ratio),
    fat_g: round1(Number(entry.fat_g) * ratio),
    carbs_g: round1(Number(entry.carbs_g) * ratio),
    fiber_g: round1(Number(entry.fiber_g ?? 0) * ratio),
  };
}

/** Copie d'entrées vers une autre date (sans identifiant ni date de création). */
export function buildCopiedEntries(entries: readonly Entry[], userId: string, date: string) {
  return entries.map((entry) => ({
    user_id: userId,
    date,
    label: entry.label,
    qty_grammes: entry.qty_grammes,
    kcal: entry.kcal,
    protein_g: entry.protein_g,
    fat_g: entry.fat_g,
    carbs_g: entry.carbs_g,
    fiber_g: entry.fiber_g ?? 0,
    meal_type: entry.meal_type ?? null,
    ...(entry.food_id ? { food_id: entry.food_id } : {}),
  }));
}

/**
 * Extrait la portion en grammes d'un libellé Open Food Facts
 * (« 125 g », « 1 pot (125 g) », « 30g », « 2 biscuits (25,5 g) »).
 * Les volumes (ml, cl) et unités inconnues sont ignorés.
 */
export function parseServingGrams(servingSize?: string | null): number | null {
  if (!servingSize) return null;
  const match = /(\d+(?:[.,]\d+)?)\s*(?:g|gr|grammes?)\b/i.exec(servingSize);
  if (!match) return null;
  const grams = Number(match[1].replace(',', '.'));
  return Number.isFinite(grams) && grams > 0 && grams <= 2000 ? grams : null;
}
