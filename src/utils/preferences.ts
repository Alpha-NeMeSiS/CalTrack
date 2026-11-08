// Préférences d'affichage (fonctions pures, testables).
// Stockées dans la table user_preferences ; sans ligne, valeurs par défaut.
import { MEAL_LABELS, MealType } from './entries';
import { isThemePreference, ThemePreference } from './theme';

export type CalorieDisplay = 'consumed' | 'remaining';
export type MacroDisplay = 'grams' | 'percent';

export interface UserPreferences {
  /** Thème : suit l'appareil, toujours clair ou toujours sombre */
  theme: ThemePreference;
  /** Calories du jour : consommées / objectif, ou restantes en avant */
  calorieDisplay: CalorieDisplay;
  /** Macros : grammes consommés / objectif, ou % de l'objectif atteint */
  macroDisplay: MacroDisplay;
  /** Noms personnalisés des repas (absent = nom par défaut) */
  mealLabels: Partial<Record<MealType, string>>;
  /** Repas masqués dans les choix de saisie */
  hiddenMeals: MealType[];
  /** Heure du rappel de pesée (« HH:MM », null = désactivé) */
  reminderWeighInTime: string | null;
  /** Heure du rappel du journal (« HH:MM », null = désactivé) */
  reminderLogTime: string | null;
  /** Fuseau horaire des rappels (IANA, ex. Europe/Paris) */
  timezone: string;
}

/** Heures proposées quand un rappel est activé */
export const DEFAULT_REMINDER_TIMES = { weighIn: '08:00', log: '20:30' } as const;

/** Fuseau horaire de l'appareil (Europe/Paris si inconnu) */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
  } catch {
    return 'Europe/Paris';
  }
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** « 08:00:00 » (Postgres) → « 08:00 » ; null si vide ou invalide */
function normalizeTime(value: string | null | undefined): string | null {
  const time = value?.slice(0, 5) ?? '';
  return TIME_PATTERN.test(time) ? time : null;
}

export const ALL_MEALS: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_LABEL_MAX_LENGTH = 30;

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  calorieDisplay: 'consumed',
  macroDisplay: 'grams',
  mealLabels: {},
  hiddenMeals: [],
  reminderWeighInTime: null,
  reminderLogTime: null,
  timezone: 'Europe/Paris',
};

/** Ligne de la table user_preferences */
export interface UserPreferencesRow {
  user_id: string;
  theme: ThemePreference;
  calorie_display: CalorieDisplay;
  macro_display: MacroDisplay;
  meal_label_breakfast: string | null;
  meal_label_lunch: string | null;
  meal_label_dinner: string | null;
  meal_label_snack: string | null;
  hidden_meals: string[];
  reminder_weigh_in_time?: string | null;
  reminder_log_time?: string | null;
  timezone?: string;
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
    theme: isThemePreference(row.theme) ? row.theme : 'system',
    calorieDisplay: row.calorie_display === 'remaining' ? 'remaining' : 'consumed',
    macroDisplay: row.macro_display === 'percent' ? 'percent' : 'grams',
    mealLabels,
    hiddenMeals: (row.hidden_meals ?? []).filter(isMealType),
    reminderWeighInTime: normalizeTime(row.reminder_weigh_in_time),
    reminderLogTime: normalizeTime(row.reminder_log_time),
    timezone: row.timezone || DEFAULT_PREFERENCES.timezone,
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
    theme: preferences.theme,
    calorie_display: preferences.calorieDisplay,
    macro_display: preferences.macroDisplay,
    meal_label_breakfast: label('breakfast'),
    meal_label_lunch: label('lunch'),
    meal_label_dinner: label('dinner'),
    meal_label_snack: label('snack'),
    hidden_meals: ALL_MEALS.filter((meal) => preferences.hiddenMeals.includes(meal)),
    reminder_weigh_in_time: normalizeTime(preferences.reminderWeighInTime),
    reminder_log_time: normalizeTime(preferences.reminderLogTime),
    timezone: preferences.timezone || DEFAULT_PREFERENCES.timezone,
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
  for (const time of [preferences.reminderWeighInTime, preferences.reminderLogTime]) {
    if (time !== null && !TIME_PATTERN.test(time)) {
      errors.push('Indiquez une heure de rappel valide (ex. 08:00).');
      break;
    }
  }
  return errors;
}
