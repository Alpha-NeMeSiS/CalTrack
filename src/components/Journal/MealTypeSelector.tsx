// Choix du repas d'une entrée (repas visibles et noms personnalisés des préférences)
import { usePreferences } from '../../contexts/usePreferences';
import type { MealType } from '../../utils/entries';
import { getMealLabel, getVisibleMeals } from '../../utils/preferences';

export function MealTypeSelector({
  value,
  onChange,
}: {
  value?: MealType;
  onChange: (value?: MealType) => void;
}) {
  // Repas visibles (préférences), avec leurs noms personnalisés
  const { preferences } = usePreferences();
  const mealOptions = getVisibleMeals(preferences).map((meal) => ({ value: meal, label: getMealLabel(preferences, meal) }));
  return (
    <div>
      <label className="field-label mb-2">Type de repas (optionnel)</label>
      <div className="grid grid-cols-2 gap-2">
        {mealOptions.map((meal) => (
          <button
            key={meal.value}
            type="button"
            onClick={() => onChange(value === meal.value ? undefined : meal.value)}
            className={`py-2 px-3 text-sm border-2 rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 ${
              value === meal.value
                ? 'border-primary-600 bg-primary-50 text-primary-700'
                : 'border-line-strong bg-surface text-body hover:border-line-emphasis'
            }`}
            aria-pressed={value === meal.value}
          >
            {meal.label}
          </button>
        ))}
      </div>
    </div>
  );
}
