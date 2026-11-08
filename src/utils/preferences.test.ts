import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  getMealLabel,
  getVisibleMeals,
  preferencesFromRow,
  preferencesToRow,
  validatePreferences,
} from './preferences';

describe('préférences', () => {
  it('utilise les valeurs par défaut sans ligne en base', () => {
    expect(preferencesFromRow(null)).toEqual(DEFAULT_PREFERENCES);
    expect(getMealLabel(DEFAULT_PREFERENCES, 'snack')).toBe('Collation');
    expect(getVisibleMeals(DEFAULT_PREFERENCES)).toEqual(['breakfast', 'lunch', 'dinner', 'snack']);
  });

  it('lit une ligne (noms vides ignorés, repas inconnus filtrés)', () => {
    const prefs = preferencesFromRow({
      calorie_display: 'remaining',
      macro_display: 'percent',
      meal_label_snack: '  Collation du matin ',
      meal_label_lunch: '   ',
      hidden_meals: ['dinner', 'brunch'],
      reminder_weigh_in_time: '07:45:00',
      reminder_log_time: null,
      timezone: 'America/Toronto',
      water_goal_ml: 2500,
    });

    expect(prefs).toEqual({
      theme: 'system',
      calorieDisplay: 'remaining',
      macroDisplay: 'percent',
      mealLabels: { snack: 'Collation du matin' },
      hiddenMeals: ['dinner'],
      reminderWeighInTime: '07:45',
      reminderLogTime: null,
      timezone: 'America/Toronto',
      waterGoalMl: 2500,
    });
    expect(getMealLabel(prefs, 'snack')).toBe('Collation du matin');
    expect(getMealLabel(prefs, 'lunch')).toBe('Déjeuner');
    expect(getVisibleMeals(prefs)).toEqual(['breakfast', 'lunch', 'snack']);
  });

  it("prépare la ligne à enregistrer (nom par défaut ou vide → NULL, repas dans l'ordre)", () => {
    const row = preferencesToRow(
      'user-1',
      {
        theme: 'dark',
        calorieDisplay: 'consumed',
        macroDisplay: 'grams',
        mealLabels: { breakfast: 'Petit-déjeuner', lunch: ' Repas du midi ', dinner: '' },
        hiddenMeals: ['snack', 'breakfast'],
        reminderWeighInTime: '08:00',
        reminderLogTime: '25:00', // invalide → désactivé
        timezone: 'Europe/Paris',
        waterGoalMl: null,
      },
      new Date('2026-11-08T10:00:00Z')
    );

    expect(row).toEqual({
      user_id: 'user-1',
      theme: 'dark',
      calorie_display: 'consumed',
      macro_display: 'grams',
      meal_label_breakfast: null,
      meal_label_lunch: 'Repas du midi',
      meal_label_dinner: null,
      meal_label_snack: null,
      hidden_meals: ['breakfast', 'snack'],
      reminder_weigh_in_time: '08:00',
      reminder_log_time: null,
      timezone: 'Europe/Paris',
      water_goal_ml: null,
      updated_at: '2026-11-08T10:00:00.000Z',
    });
  });

  it('refuse de masquer tous les repas et les noms trop longs', () => {
    expect(validatePreferences({ ...DEFAULT_PREFERENCES, hiddenMeals: ['breakfast', 'lunch', 'dinner', 'snack'] })).toEqual([
      'Gardez au moins un repas visible.',
    ]);
    expect(validatePreferences({ ...DEFAULT_PREFERENCES, mealLabels: { lunch: 'x'.repeat(31) } })).toHaveLength(1);
    expect(validatePreferences(DEFAULT_PREFERENCES)).toEqual([]);
  });

  it('refuse une heure de rappel invalide', () => {
    expect(validatePreferences({ ...DEFAULT_PREFERENCES, reminderLogTime: '7h30' })).toEqual([
      'Indiquez une heure de rappel valide (ex. 08:00).',
    ]);
    expect(validatePreferences({ ...DEFAULT_PREFERENCES, reminderLogTime: '20:30' })).toEqual([]);
  });

  it('borne l’objectif d’eau manuel', () => {
    expect(DEFAULT_PREFERENCES.waterGoalMl).toBeNull();
    expect(validatePreferences({ ...DEFAULT_PREFERENCES, waterGoalMl: 300 })).toEqual([
      'L’objectif d’eau doit être compris entre 0,5 et 6 L.',
    ]);
    expect(validatePreferences({ ...DEFAULT_PREFERENCES, waterGoalMl: 2500 })).toEqual([]);
    expect(preferencesToRow('user-1', { ...DEFAULT_PREFERENCES, waterGoalMl: 2500 }).water_goal_ml).toBe(2500);
    expect(preferencesFromRow({ water_goal_ml: null }).waterGoalMl).toBeNull();
  });
});

