// Logique du journal alimentaire (fonctions pures, testables).
import type { Entry } from '../../shared/supabase';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** Entrée prête à ajouter au journal (onglets de la fenêtre d'ajout) */
export type AddEntryPayload = Pick<
  Entry,
  'food_id' | 'label' | 'qty_grammes' | 'kcal' | 'protein_g' | 'fat_g' | 'carbs_g' | 'fiber_g' | 'meal_type'
>;

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

/** Calories et macros d'un repas ou de la journée (arrondies à l'unité) */
export interface MealTotals {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
}

export interface MealSummary extends MealTotals {
  meal: MealType | 'other';
  label: string;
  /** Part des kcal de la journée, en % entier (0 si la journée fait 0 kcal) */
  sharePct: number;
}

/** Fenêtre « Détail par repas » : chaque repas et le total de la journée */
export interface MealBreakdown {
  meals: MealSummary[];
  total: MealTotals;
}

type TotalsSource = Pick<Entry, 'meal_type' | 'kcal' | 'protein_g' | 'fat_g' | 'carbs_g' | 'fiber_g'>;

/** Sommes brutes : les arrondis ne sont faits qu'à la fin, pour ne pas les cumuler. */
function sumTotals(entries: readonly TotalsSource[]): MealTotals {
  const sum = (field: keyof MealTotals) => entries.reduce((total, entry) => total + (Number(entry[field]) || 0), 0);
  return { kcal: sum('kcal'), protein_g: sum('protein_g'), fat_g: sum('fat_g'), carbs_g: sum('carbs_g'), fiber_g: sum('fiber_g') };
}

const roundTotals = (totals: MealTotals): MealTotals => ({
  kcal: Math.round(totals.kcal),
  protein_g: Math.round(totals.protein_g),
  fat_g: Math.round(totals.fat_g),
  carbs_g: Math.round(totals.carbs_g),
  fiber_g: Math.round(totals.fiber_g),
});

/**
 * Ce que chaque repas a apporté dans la journée : kcal, macros et part des
 * kcal. Seuls les repas qui ont des aliments, dans l'ordre de la journée.
 * `getLabel` permet d'utiliser les noms de repas personnalisés.
 */
export function summarizeMeals(
  entries: readonly TotalsSource[],
  getLabel: (meal: MealType | 'other') => string = (meal) => MEAL_LABELS[meal]
): MealBreakdown {
  const dayTotals = sumTotals(entries);
  const meals = MEAL_ORDER.map((meal) => ({
    meal,
    items: entries.filter((entry) => (entry.meal_type ?? 'other') === meal),
  }))
    .filter(({ items }) => items.length > 0)
    .map(({ meal, items }) => {
      const totals = sumTotals(items);
      return {
        meal,
        label: getLabel(meal),
        ...roundTotals(totals),
        // Journée à 0 kcal (eau, café noir) : 0 %, jamais NaN
        sharePct: dayTotals.kcal > 0 ? Math.round((totals.kcal / dayTotals.kcal) * 100) : 0,
      };
    });
  return { meals, total: roundTotals(dayTotals) };
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
const GRAMS = /(\d+(?:[.,]\d+)?)\s*(?:g|gr|grammes?)\b/i;
// Boissons : ml, cl, l (ou litre), converties en ml
const VOLUME = /(\d+(?:[.,]\d+)?)\s*(ml|cl|l|litres?)\b/i;
const ML_PER_UNIT: Record<string, number> = { ml: 1, cl: 10, l: 1000, litre: 1000, litres: 1000 };

const toNumber = (text: string) => Number(text.replace(',', '.'));
const plausible = (value: number) => (Number.isFinite(value) && value > 0 && value <= 2000 ? value : null);

/**
 * Portion du fabricant en grammes (« 1 pot (125 g) » → 125). Pour une boisson,
 * la portion en volume est convertie avec 1 ml ≈ 1 g (« 20 cl » → 200), ce qui
 * est juste pour les jus, le lait ou les sodas. Les grammes priment si les deux
 * sont indiqués.
 */
export function parseServingGrams(servingSize?: string | null): number | null {
  if (!servingSize) return null;
  const grams = GRAMS.exec(servingSize);
  if (grams) return plausible(toNumber(grams[1]));
  const volume = VOLUME.exec(servingSize);
  if (!volume) return null;
  return plausible(Math.round(toNumber(volume[1]) * ML_PER_UNIT[volume[2].toLowerCase()]));
}

/** Unité à afficher pour la portion : « ml » pour une boisson, sinon « g ». */
export function servingUnit(servingSize?: string | null): 'g' | 'ml' {
  if (!servingSize || GRAMS.test(servingSize)) return 'g';
  return VOLUME.test(servingSize) ? 'ml' : 'g';
}
