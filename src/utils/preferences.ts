// Préférences d'affichage (fonctions pures, testables).
// Stockées dans la table user_preferences ; sans ligne, valeurs par défaut.
import { MEAL_LABELS, MealType } from './entries';

export type CalorieDisplay = 'consumed' | 'remaining';
export type MacroDisplay = 'grams' | 'percent';

export interface UserPreferences {
  /** Calories du jour : consommées / objectif, ou restantes en avant */
  calorieDisplay: CalorieDisplay;
  /** Macros : grammes consommés / objectif, ou % de l'objectif atteint */
  macroDisplay: MacroDisplay;
  /** Noms personnalisés des repas (absent = nom par défaut) */
  mealLabels: Partial<Record<MealType, string>>;
  /** Repas masqués dans les choix de saisie */
  hiddenMeals: MealType[];
}

export const ALL_MEALS: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_LABEL_MAX_LENGTH = 30;

export const DEFAULT_PREFERENCES: UserPreferences = {
  calorieDisplay: 'consumed',
  macroDisplay: 'grams',
  mealLabels: {},
  hiddenMeals: [],
};

/** Ligne de la table user_preferences */
export interface UserPreferencesRow {
  user_id: string;
  calorie_display: CalorieDisplay;
  macro_display: MacroDisplay;
  meal_label_breakfast: string | null;
  meal_label_lunch: string | null;
  meal_label_dinner: string | null;
  meal_label_snack: string | null;
  hidden_meals: string[];
  updated_at?: string;
}

const isMealType = (value: string): value is MealType => (ALL_MEALS as readonly string[]).includes(value);

export function preferencesFromRow(row: Partial<UserPreferencesRow> | null | undefined): UserPreferences {
  if (!row) return DEFAULT_PREFERENCES;
  const mealLabels: Partial<Record<MealType, string>> = {};
  for (const meal of ALL_MEALS) {
    const label = row[`meal_label_${meal}`]?.trim();
    if (label) mealLabels[meal] = label;
  }
  return {
    calorieDisplay: row.calorie_display === 'remaining' ? 'remaining' : 'consumed',
    macroDisplay: row.macro_display === 'percent' ? 'percent' : 'grams',
    mealLabels,
    hiddenMeals: (row.hidden_meals ?? []).filter(isMealType),
  };
}

export function preferencesToRow(userId: string, preferences: UserPreferences, now = new Date()): UserPreferencesRow {
  const label = (meal: MealType) => {
    const value = preferences.mealLabels[meal]?.trim();
    // Un nom identique au nom par défaut n'est pas enregistré
    return value && value !== MEAL_LABELS[meal] ? value : null;
  };
  return {
    user_id: userId,
    calorie_display: preferences.calorieDisplay,
    macro_display: preferences.macroDisplay,
    meal_label_breakfast: label('breakfast'),
    meal_label_lunch: label('lunch'),
    meal_label_dinner: label('dinner'),
    meal_label_snack: label('snack'),
    hidden_meals: ALL_MEALS.filter((meal) => preferences.hiddenMeals.includes(meal)),
    updated_at: now.toISOString(),
  };
}

/** Nom affiché d'un repas (personnalisé, sinon par défaut) */
export function getMealLabel(preferences: UserPreferences, meal: MealType | 'other'): string {
  if (meal === 'other') return MEAL_LABELS.other;
  return preferences.mealLabels[meal]?.trim() || MEAL_LABELS[meal];
}

/** Repas proposés à la saisie, dans l'ordre de la journée */
export function getVisibleMeals(preferences: UserPreferences): MealType[] {
  return ALL_MEALS.filter((meal) => !preferences.hiddenMeals.includes(meal));
}

/** Erreurs de saisie (vide si valide) */
export function validatePreferences(preferences: UserPreferences): string[] {
  const errors: string[] = [];
  if (getVisibleMeals(preferences).length === 0) {
    errors.push('Gardez au moins un repas visible.');
  }
  for (const meal of ALL_MEALS) {
    const label = preferences.mealLabels[meal];
    if (label !== undefined && label.trim().length > MEAL_LABEL_MAX_LENGTH) {
      errors.push(`Le nom « ${label.trim().slice(0, 12)}… » dépasse ${MEAL_LABEL_MAX_LENGTH} caractères.`);
    }
  }
  return errors;
}
