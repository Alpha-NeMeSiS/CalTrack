// Recettes (plats maison en parts) : totaux, portions au journal, libellés et
// validation. Fonctions pures, arrondies comme le reste du journal (kcal à
// l'unité, macros au dixième, poids au gramme).
import type { Entry, Recipe, RecipeIngredient } from '../lib/supabase';
import type { MealType } from './entries';
import { mostFrequent } from './foodLibrary';
import { formatDecimal, formatNumber } from './format';

export type IngredientValues = Pick<
  RecipeIngredient,
  'label' | 'qty_g' | 'kcal_per_100g' | 'protein_g' | 'fat_g' | 'carbs_g' | 'fiber_g'
>;

/** Recette en cours de saisie (ou à enregistrer) */
export interface RecipeDraft {
  id?: string;
  name: string;
  servings: number;
  cooked_weight_g: number | null;
  ingredients: IngredientValues[];
}

export interface Nutrition {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
}

export interface RecipeTotals extends Nutrition {
  /** Poids cru total des ingrédients (g) */
  weight_g: number;
}

export type PortionChoice = { mode: 'servings'; servings: number } | { mode: 'grams'; grams: number };

/** Portion prête à noter au journal */
export interface RecipePortion extends Nutrition {
  qty_grammes: number;
  label: string;
}

export const RECIPE_LIMITS = {
  nameMax: 120,
  servingsMax: 50,
  cookedMax: 20000,
  ingredientsMax: 50,
  qtyMax: 5000,
  /** Portion ajoutée au journal : de 0,5 à 20 parts, par demi-part */
  portionMin: 0.5,
  portionMax: 20,
  portionStep: 0.5,
} as const;

const round1 = (value: number) => Math.round(value * 10) / 10;
const isBetween = (value: number, min: number, max: number) => Number.isFinite(value) && value >= min && value <= max;

export function recipeTotals(ingredients: readonly IngredientValues[]): RecipeTotals {
  const sum = ingredients.reduce(
    (acc, item) => {
      const ratio = item.qty_g / 100;
      acc.weight_g += item.qty_g;
      acc.kcal += item.kcal_per_100g * ratio;
      acc.protein_g += item.protein_g * ratio;
      acc.fat_g += item.fat_g * ratio;
      acc.carbs_g += item.carbs_g * ratio;
      acc.fiber_g += (item.fiber_g ?? 0) * ratio;
      return acc;
    },
    { weight_g: 0, kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0 }
  );
  return {
    weight_g: Math.round(sum.weight_g),
    kcal: Math.round(sum.kcal),
    protein_g: round1(sum.protein_g),
    fat_g: round1(sum.fat_g),
    carbs_g: round1(sum.carbs_g),
    fiber_g: round1(sum.fiber_g),
  };
}

/** Part des totaux (valeurs non arrondies d'abord, pour éviter les écarts) */
function share(ingredients: readonly IngredientValues[], ratio: number): Nutrition {
  const raw = ingredients.reduce(
    (acc, item) => {
      const grams = (item.qty_g / 100) * ratio;
      acc.kcal += item.kcal_per_100g * grams;
      acc.protein_g += item.protein_g * grams;
      acc.fat_g += item.fat_g * grams;
      acc.carbs_g += item.carbs_g * grams;
      acc.fiber_g += (item.fiber_g ?? 0) * grams;
      return acc;
    },
    { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0 }
  );
  return {
    kcal: Math.round(raw.kcal),
    protein_g: round1(raw.protein_g),
    fat_g: round1(raw.fat_g),
    carbs_g: round1(raw.carbs_g),
    fiber_g: round1(raw.fiber_g),
  };
}

export function recipeEntryLabel(name: string, choice: PortionChoice): string {
  const portion =
    choice.mode === 'grams'
      ? `${formatNumber(Math.round(choice.grams))} g`
      : `${formatDecimal(choice.servings)} ${choice.servings < 2 ? 'part' : 'parts'}`;
  return `${name.trim()} — ${portion}`;
}

export function portionByServings(recipe: RecipeDraft, servings: number): RecipePortion {
  const ratio = servings / recipe.servings;
  const weight = recipe.cooked_weight_g ?? recipe.ingredients.reduce((sum, item) => sum + item.qty_g, 0);
  return {
    label: recipeEntryLabel(recipe.name, { mode: 'servings', servings }),
    qty_grammes: Math.round(weight * ratio),
    ...share(recipe.ingredients, ratio),
  };
}

/** Portion en grammes : seulement si le poids cuit est connu */
export function portionByGrams(recipe: RecipeDraft, grams: number): RecipePortion | null {
  if (!recipe.cooked_weight_g) return null;
  return {
    label: recipeEntryLabel(recipe.name, { mode: 'grams', grams }),
    qty_grammes: Math.round(grams),
    ...share(recipe.ingredients, grams / recipe.cooked_weight_g),
  };
}

export function recipePortion(recipe: RecipeDraft, choice: PortionChoice): RecipePortion | null {
  return choice.mode === 'grams' ? portionByGrams(recipe, choice.grams) : portionByServings(recipe, choice.servings);
}

/** Premier problème de la recette, ou null si elle peut être enregistrée */
export function validateRecipe(draft: RecipeDraft): string | null {
  const name = draft.name.trim();
  if (!name) return 'Donnez un nom à la recette.';
  if (name.length > RECIPE_LIMITS.nameMax) return 'Le nom de la recette ne doit pas dépasser 120 caractères.';
  if (!Number.isInteger(draft.servings) || !isBetween(draft.servings, 1, RECIPE_LIMITS.servingsMax)) {
    return 'Le nombre de parts doit être compris entre 1 et 50.';
  }
  if (draft.cooked_weight_g !== null && !isBetween(draft.cooked_weight_g, 1, RECIPE_LIMITS.cookedMax)) {
    return 'Le poids cuit doit être compris entre 1 et 20 000 g.';
  }
  if (draft.ingredients.length === 0) return 'Ajoutez au moins un ingrédient.';
  if (draft.ingredients.length > RECIPE_LIMITS.ingredientsMax) return 'Une recette compte au plus 50 ingrédients.';
  if (draft.ingredients.some((item) => !isBetween(item.qty_g, 1, RECIPE_LIMITS.qtyMax))) {
    return 'La quantité de chaque ingrédient doit être comprise entre 1 et 5 000 g.';
  }
  return null;
}

/** Repas le plus fréquent parmi les entrées « Nom — … » de la recette */
export function usualRecipeMeal(name: string, entries: readonly Entry[]): MealType | undefined {
  const prefix = `${name.trim()} — `;
  return mostFrequent(
    entries
      .filter((entry) => entry.label?.startsWith(prefix))
      .map((entry) => entry.meal_type)
      .filter((meal): meal is MealType => Boolean(meal))
  );
}

export function recipeToDraft(recipe: Recipe): RecipeDraft {
  return {
    id: recipe.id,
    name: recipe.name,
    servings: recipe.servings,
    cooked_weight_g: recipe.cooked_weight_g,
    ingredients: [...recipe.recipe_ingredients]
      .sort((a, b) => a.position - b.position)
      .map(({ label, qty_g, kcal_per_100g, protein_g, fat_g, carbs_g, fiber_g }) => ({
        label,
        qty_g: Number(qty_g),
        kcal_per_100g: Number(kcal_per_100g),
        protein_g: Number(protein_g),
        fat_g: Number(fat_g),
        carbs_g: Number(carbs_g),
        fiber_g: Number(fiber_g),
      })),
  };
}
