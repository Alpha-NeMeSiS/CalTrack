// Page « Paramètres » (menu du compte) : thème, affichage des calories et des
// macros, noms et visibilité des repas, rappels.
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Palette, Save, UtensilsCrossed } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { usePreferences } from '../../contexts/usePreferences';
import { MEAL_LABELS } from '../../utils/entries';
import {
  ALL_MEALS,
  CalorieDisplay,
  DEFAULT_PREFERENCES,
  DEFAULT_REMINDER_TIMES,
  MacroDisplay,
  deviceTimezone,
  MEAL_LABEL_MAX_LENGTH,
  UserPreferences,
  validatePreferences,
} from '../../utils/preferences';
import { applyTheme, readStoredTheme, ThemePreference } from '../../utils/theme';
import { RemindersSection } from './RemindersSection';
import { WaterGoalSection } from './WaterGoalSection';

const THEME_OPTIONS: { value: ThemePreference; label: string; example: string }[] = [
  { value: 'system', label: 'Automatique', example: 'Suit le réglage de l’appareil' },
  { value: 'light', label: 'Clair', example: 'Toujours clair' },
  { value: 'dark', label: 'Sombre', example: 'Toujours sombre' },
];

const CALORIE_OPTIONS: { value: CalorieDisplay; label: string; example: string }[] = [
  { value: 'consumed', label: 'Consommées / objectif', example: 'ex. 1 450 / 2 150 kcal' },
  { value: 'remaining', label: 'Calories restantes', example: 'ex. 700 kcal restantes' },
];

const MACRO_OPTIONS: { value: MacroDisplay; label: string; example: string }[] = [
  { value: 'grams', label: 'En grammes', example: 'ex. 69 / 158 g' },
  { value: 'percent', label: 'En % de l’objectif', example: 'ex. 44 %' },
];

function OptionGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  columns = 2,
}: {
  legend: string;
  name: string;
  options: { value: T; label: string; example: string }[];
  value: T;
  onChange: (value: T) => void;
  columns?: 2 | 3;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-body">{legend}</legend>
      <div className={`grid grid-cols-1 gap-2 ${columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer items-start gap-3 rounded-md border-2 p-3 transition-colors ${
              value === option.value ? 'border-primary-600 bg-primary-50' : 'border-line hover:border-line-strong'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium text-ink">{option.label}</span>
              <span className="block text-xs text-subtle">{option.example}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SettingsPage() {
  const { preferences, savePreferences } = usePreferences();
  const { profile } = useAuth();
  const [form, setForm] = useState<UserPreferences>(preferences);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Préférences chargées (ou enregistrées) : le formulaire les reprend. Si
  // l'utilisateur a des modifications non enregistrées, elles sont gardées et
  // seuls les rappels (qui peuvent être enregistrés à part) sont repris.
  const syncedPreferences = useRef(preferences);
  useEffect(() => {
    setForm((current) =>
      JSON.stringify(current) === JSON.stringify(syncedPreferences.current)
        ? preferences
        : { ...current, reminderWeighInTime: preferences.reminderWeighInTime, reminderLogTime: preferences.reminderLogTime }
    );
    syncedPreferences.current = preferences;
  }, [preferences]);

  /**
   * Notifications activées sur cet appareil : si aucun rappel n'est encore
   * programmé, on les programme tout de suite (heures cochées dans le
   * formulaire, sinon heures par défaut), sans attendre « Enregistrer ».
   */
  const handleDeviceEnabled = async (): Promise<string | null> => {
    if (preferences.reminderWeighInTime || preferences.reminderLogTime) return null;
    const chosen = form.reminderWeighInTime || form.reminderLogTime;
    const weighInTime = chosen ? form.reminderWeighInTime : DEFAULT_REMINDER_TIMES.weighIn;
    const logTime = chosen ? form.reminderLogTime : DEFAULT_REMINDER_TIMES.log;
    await savePreferences({
      ...preferences,
      reminderWeighInTime: weighInTime,
      reminderLogTime: logTime,
      timezone: deviceTimezone(),
    });
    const parts = [weighInTime && `pesée à ${weighInTime}`, logTime &&`journal à ${logTime}`].filter(Boolean);
    return `Rappels programmés : ${parts.join(' et ')} (heures modifiables ci-dessus).`;
  };

  // Aperçu immédiat du thème choisi ; en quittant la page sans enregistrer,
  // le thème mémorisé est rétabli
  useEffect(() => {
    applyTheme(form.theme, { persist: false });
  }, [form.theme]);
  useEffect(() => () => applyTheme(readStoredTheme(), { persist: false }), []);

  const setMealLabel = (meal: (typeof ALL_MEALS)[number], label: string) =>
    setForm({ ...form, mealLabels: { ...form.mealLabels, [meal]: label } });

  const toggleMeal = (meal: (typeof ALL_MEALS)[number], visible: boolean) =>
    setForm({
      ...form,
      hiddenMeals: visible ? form.hiddenMeals.filter((item) => item !== meal) : [...form.hiddenMeals, meal],
    });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);

    const errors = validatePreferences(form);
    if (errors.length > 0) {
      setMessage({ type: 'error', text: errors.join(' ') });
      return;
    }

    setSaving(true);
    try {
      // Les rappels suivent le fuseau horaire de l'appareil utilisé pour régler
      await savePreferences({ ...form, timezone: deviceTimezone() });
      setMessage({ type: 'success', text: 'Paramètres enregistrés.' });
    } catch (error) {
      console.error('Error saving preferences:', error);
      setMessage({ type: 'error', text: "Les paramètres n'ont pas pu être enregistrés. Réessayez." });
    } finally {
      setSaving(false);
    }
  };

  const visibleCount = ALL_MEALS.length - form.hiddenMeals.length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="page-title">Paramètres</h1>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <section aria-labelledby="display-title" className="space-y-5 panel p-4 sm:p-6">
          <h2 id="display-title" className="flex items-center gap-2 card-title">
            <Palette className="h-5 w-5 text-subtle" aria-hidden="true" />
            Affichage
          </h2>
          <OptionGroup
            legend="Thème"
            name="theme"
            options={THEME_OPTIONS}
            value={form.theme}
            onChange={(theme) => setForm({ ...form, theme })}
            columns={3}
          />
          <OptionGroup
            legend="Calories du jour"
            name="calorie-display"
            options={CALORIE_OPTIONS}
            value={form.calorieDisplay}
            onChange={(calorieDisplay) => setForm({ ...form, calorieDisplay })}
          />
          <OptionGroup
            legend="Macronutriments"
            name="macro-display"
            options={MACRO_OPTIONS}
            value={form.macroDisplay}
            onChange={(macroDisplay) => setForm({ ...form, macroDisplay })}
          />
        </section>

        <section aria-labelledby="meals-title" className="space-y-4 panel p-4 sm:p-6">
          <div>
            <h2 id="meals-title" className="flex items-center gap-2 card-title">
              <UtensilsCrossed className="h-5 w-5 text-subtle" aria-hidden="true" />
              Repas
            </h2>
            <p className="mt-1 text-sm text-muted">
              Renommez vos repas ou masquez ceux que vous ne prenez pas. Un repas masqué n’est plus proposé à
              l’ajout d’un aliment ; ce que vous avez déjà saisi reste affiché.
            </p>
          </div>

          <ul className="divide-y divide-line-subtle">
            {ALL_MEALS.map((meal) => {
              const visible = !form.hiddenMeals.includes(meal);
              const isLastVisible = visible && visibleCount === 1;
              return (
                <li key={meal} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
                  <label className="flex min-w-[9rem] items-center gap-2 text-sm text-body">
                    <input
                      type="checkbox"
                      checked={visible}
                      disabled={isLastVisible}
                      onChange={(e) => toggleMeal(meal, e.target.checked)}
                      aria-label={`Afficher « ${MEAL_LABELS[meal]} »`}
                    />
                    {MEAL_LABELS[meal]}
                  </label>
                  <div className="flex-1">
                    <label htmlFor={`meal-label-${meal}`} className="sr-only">
                      Nom du repas « {MEAL_LABELS[meal]} »
                    </label>
                    <input
                      id={`meal-label-${meal}`}
                      type="text"
                      value={form.mealLabels[meal] ?? ''}
                      placeholder={MEAL_LABELS[meal]}
                      maxLength={MEAL_LABEL_MAX_LENGTH}
                      disabled={!visible}
                      onChange={(e) => setMealLabel(meal, e.target.value)}
                      className="w-full field-input px-3 py-2 text-sm disabled:bg-surface-muted disabled:text-subtle"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <WaterGoalSection
          goalMl={form.waterGoalMl}
          weightKg={profile?.poids_kg}
          onChange={(waterGoalMl) => setForm({ ...form, waterGoalMl })}
        />

        <RemindersSection
          weighInTime={form.reminderWeighInTime}
          logTime={form.reminderLogTime}
          onChange={({ weighInTime, logTime }) =>
            setForm({ ...form, reminderWeighInTime: weighInTime, reminderLogTime: logTime })
          }
          onDeviceEnabled={handleDeviceEnabled}
        />

        {message && (
          <p
            role={message.type === 'error' ? 'alert' : 'status'}
            className={`rounded-md border p-3 text-sm ${
              message.type === 'error' ? 'border-danger-200 bg-danger-50 text-danger-700' : 'border-success-200 bg-success-50 text-success-700'
            }`}
          >
            {message.text}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => {
              setForm(DEFAULT_PREFERENCES);
              setMessage(null);
            }}
            className="rounded-md btn-secondary px-4 py-2 font-medium"
          >
            Valeurs par défaut
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-md btn-primary px-4 py-2 font-medium"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {saving ? 'Enregistrement…' : 'Enregistrer les paramètres'}
          </button>
        </div>
      </form>
    </div>
  );
}
