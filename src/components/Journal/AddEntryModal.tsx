// Modal pour ajouter une entrée alimentaire
// Permet de rechercher un aliment, saisir la quantité et obtenir les valeurs nutritionnelles calculées
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { FoodSearch } from '../Foods/FoodSearch';
import { useAuth } from '../../contexts/AuthContext';
import { Entry, supabase } from '../../lib/supabase';
import type { NormalizedFood } from '../../types/food';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type AddEntryPayload = Pick<
  Entry,
  'food_id' | 'label' | 'qty_grammes' | 'kcal' | 'protein_g' | 'fat_g' | 'carbs_g' | 'fiber_g' | 'meal_type'
>;
type AddEntryMode = 'search' | 'manual' | 'quick';

type ManualFormState = {
  label: string;
  qty_grammes: number;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
  meal_type?: MealType;
};

interface AddEntryModalProps {
  date: string;
  onClose: () => void;
  onAdd: (entry: AddEntryPayload) => Promise<boolean>;
}

const mealOptions: Array<{ value: MealType; label: string }> = [
  { value: 'breakfast', label: 'Petit-déjeuner' },
  { value: 'lunch', label: 'Déjeuner' },
  { value: 'dinner', label: 'Dîner' },
  { value: 'snack', label: 'Collation' },
];

const tabOptions: Array<{ value: AddEntryMode; label: string }> = [
  { value: 'search', label: 'Recherche' },
  { value: 'manual', label: 'Saisie manuelle' },
  { value: 'quick', label: 'Ajout rapide' },
];

const defaultManualForm: ManualFormState = {
  label: '',
  qty_grammes: 100,
  kcal: 0,
  protein_g: 0,
  fat_g: 0,
  carbs_g: 0,
  fiber_g: 0,
  meal_type: undefined,
};

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function getMealTypeLabel(mealType?: MealType) {
  return mealOptions.find((meal) => meal.value === mealType)?.label;
}

function formatRecentDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function getRecentEntryKey(entry: Pick<Entry, 'label' | 'qty_grammes' | 'kcal' | 'protein_g' | 'fat_g' | 'carbs_g' | 'fiber_g' | 'meal_type'>) {
  return [
    entry.label ?? '',
    entry.qty_grammes,
    entry.kcal,
    entry.protein_g,
    entry.fat_g,
    entry.carbs_g,
    entry.fiber_g,
    entry.meal_type ?? '',
  ].join('::');
}

function MealTypeSelector({
  value,
  onChange,
}: {
  value?: MealType;
  onChange: (value?: MealType) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Type de repas (optionnel)</label>
      <div className="grid grid-cols-2 gap-2">
        {mealOptions.map((meal) => (
          <button
            key={meal.value}
            type="button"
            onClick={() => onChange(value === meal.value ? undefined : meal.value)}
            className={`py-2 px-3 text-sm border-2 rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              value === meal.value
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
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

export function AddEntryModal({ date, onClose, onAdd }: AddEntryModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AddEntryMode>('search');
  const [selectedFood, setSelectedFood] = useState<NormalizedFood | null>(null);
  const [quantity, setQuantity] = useState<number>(100);
  const [mealType, setMealType] = useState<MealType | undefined>(undefined);
  const [manualForm, setManualForm] = useState<ManualFormState>(defaultManualForm);
  const [manualSubmitAttempted, setManualSubmitAttempted] = useState(false);
  const [recentEntries, setRecentEntries] = useState<Entry[]>([]);
  const [recentEntriesLoading, setRecentEntriesLoading] = useState(false);
  const [recentEntriesLoaded, setRecentEntriesLoaded] = useState(false);
  const [recentEntriesError, setRecentEntriesError] = useState<string | null>(null);
  const [selectedRecentFood, setSelectedRecentFood] = useState<Entry | null>(null);
  const [quickQuantity, setQuickQuantity] = useState<number>(100);
  const [quickMealType, setQuickMealType] = useState<MealType | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (activeTab !== 'quick' || recentEntriesLoaded || !user) {
      return;
    }

    let isMounted = true;

    const loadRecentEntries = async () => {
      setRecentEntriesLoading(true);
      setRecentEntriesError(null);

      try {
        const { data, error } = await supabase
          .from('entries')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          throw error;
        }

        if (!isMounted) return;

        const deduped = new Map<string, Entry>();
        for (const entry of (data as Entry[]) ?? []) {
          const key = getRecentEntryKey(entry);
          if (!deduped.has(key)) {
            deduped.set(key, entry);
          }
          if (deduped.size >= 12) {
            break;
          }
        }

        setRecentEntries(Array.from(deduped.values()));
        setRecentEntriesLoaded(true);
      } catch (error) {
        console.error('Erreur lors du chargement des aliments récents', error);
        if (!isMounted) return;
        setRecentEntriesError('Impossible de charger les aliments récents.');
        setRecentEntriesLoaded(true);
      } finally {
        if (isMounted) {
          setRecentEntriesLoading(false);
        }
      }
    };

    loadRecentEntries();

    return () => {
      isMounted = false;
    };
  }, [activeTab, recentEntriesLoaded, user]);

  const multiplier = quantity / 100;
  const calculatedCalories = selectedFood ? Math.round(selectedFood.kcal_per_100g * multiplier) : 0;
  const calculatedProtein = selectedFood ? roundToOneDecimal(selectedFood.protein_g * multiplier) : 0;
  const calculatedFat = selectedFood ? roundToOneDecimal(selectedFood.fat_g * multiplier) : 0;
  const calculatedCarbs = selectedFood ? roundToOneDecimal(selectedFood.carbs_g * multiplier) : 0;
  const calculatedFiber = selectedFood ? roundToOneDecimal(selectedFood.fiber_g * multiplier) : 0;

  const manualErrors = useMemo(() => {
    const errors: Partial<Record<keyof ManualFormState, string>> = {};

    if (!manualForm.label.trim()) {
      errors.label = 'Le nom de l\'aliment est requis.';
    }

    if (manualForm.qty_grammes <= 0) {
      errors.qty_grammes = 'La quantité doit être supérieure à 0.';
    }

    const numericFields: Array<keyof Pick<ManualFormState, 'kcal' | 'protein_g' | 'fat_g' | 'carbs_g' | 'fiber_g'>> = [
      'kcal',
      'protein_g',
      'fat_g',
      'carbs_g',
      'fiber_g',
    ];

    for (const field of numericFields) {
      if (manualForm[field] < 0) {
        errors[field] = 'La valeur ne peut pas être négative.';
      }
    }

    return errors;
  }, [manualForm]);

  const isManualFormValid = Object.keys(manualErrors).length === 0;

  const resetSearchState = () => {
    setSelectedFood(null);
    setQuantity(100);
    setMealType(undefined);
  };

  const resetQuickState = () => {
    setSelectedRecentFood(null);
    setQuickQuantity(100);
    setQuickMealType(undefined);
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') {
      return;
    }

    event.preventDefault();

    let nextIndex = index;
    if (event.key === 'ArrowRight') {
      nextIndex = (index + 1) % tabOptions.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + tabOptions.length) % tabOptions.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabOptions.length - 1;
    }

    const nextTab = tabOptions[nextIndex];
    setActiveTab(nextTab.value);
    tabRefs.current[nextIndex]?.focus();
  };

  const submitEntry = async (entry: AddEntryPayload) => {
    setSubmitting(true);
    try {
      const success = await onAdd(entry);
      if (success) {
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSearchSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedFood || quantity <= 0) {
      return;
    }

    const id =
      selectedFood.source === 'ciqual' && selectedFood.extCode
        ? `ciqual:${selectedFood.extCode}`
        : selectedFood.source === 'off' && selectedFood.offCode
          ? `off:${selectedFood.offCode}`
          : undefined;

    await submitEntry({
      food_id: id,
      label: selectedFood.brand ? `${selectedFood.brand} ${selectedFood.name}` : selectedFood.name,
      qty_grammes: quantity,
      kcal: calculatedCalories,
      protein_g: calculatedProtein,
      fat_g: calculatedFat,
      carbs_g: calculatedCarbs,
      fiber_g: calculatedFiber,
      meal_type: mealType,
    });
  };

  const handleManualSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setManualSubmitAttempted(true);

    if (!isManualFormValid) {
      return;
    }

    await submitEntry({
      label: manualForm.label.trim(),
      qty_grammes: manualForm.qty_grammes,
      kcal: manualForm.kcal,
      protein_g: manualForm.protein_g,
      fat_g: manualForm.fat_g,
      carbs_g: manualForm.carbs_g,
      fiber_g: manualForm.fiber_g,
      meal_type: manualForm.meal_type,
    });
  };

  const handleRecentFoodSelect = (entry: Entry) => {
    const initialQuantity = entry.qty_grammes > 0 ? entry.qty_grammes : 100;

    setSelectedRecentFood(entry);
    setQuickQuantity(initialQuantity);
    setQuickMealType(entry.meal_type);
  };

  const quickBaseQuantity = selectedRecentFood?.qty_grammes && selectedRecentFood.qty_grammes > 0
    ? selectedRecentFood.qty_grammes
    : 100;
  const quickRatio = quickBaseQuantity > 0 ? quickQuantity / quickBaseQuantity : 0;
  const quickCalories = selectedRecentFood ? Math.round(selectedRecentFood.kcal * quickRatio) : 0;
  const quickProtein = selectedRecentFood ? roundToOneDecimal(selectedRecentFood.protein_g * quickRatio) : 0;
  const quickFat = selectedRecentFood ? roundToOneDecimal(selectedRecentFood.fat_g * quickRatio) : 0;
  const quickCarbs = selectedRecentFood ? roundToOneDecimal(selectedRecentFood.carbs_g * quickRatio) : 0;
  const quickFiber = selectedRecentFood ? roundToOneDecimal(selectedRecentFood.fiber_g * quickRatio) : 0;
  const isQuickQuantityValid = quickQuantity > 0;

  const handleQuickSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedRecentFood || !isQuickQuantityValid) {
      return;
    }

    await submitEntry({
      label: selectedRecentFood.label ?? 'Aliment sans nom',
      qty_grammes: quickQuantity,
      kcal: quickCalories,
      protein_g: quickProtein,
      fat_g: quickFat,
      carbs_g: quickCarbs,
      fiber_g: quickFiber,
      meal_type: quickMealType,
    });
  };

  const renderSearchTab = () => (
    <form onSubmit={handleSearchSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Aliment</label>
        <FoodSearch
          onSelect={(food) => {
            setSelectedFood(food);
            setQuantity(100);
          }}
        />
        {selectedFood && (
          <div className="mt-3 flex items-center gap-3 rounded-md border border-blue-200 bg-blue-50 p-3">
            {selectedFood.imageUrl && (
              <img
                src={selectedFood.imageUrl}
                alt=""
                className="h-12 w-12 flex-shrink-0 rounded object-cover"
              />
            )}
            <div>
              <div className="font-medium text-blue-900">
                {selectedFood.brand ? `${selectedFood.brand} ${selectedFood.name}` : selectedFood.name}
              </div>
              <div className="mt-1 text-sm text-blue-700">
                {Math.round(selectedFood.kcal_per_100g)} kcal pour 100 g
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedFood && (
        <>
          <div>
            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
              Quantité (grammes)
            </label>
            <input
              type="number"
              id="quantity"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              min="1"
              step="1"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <MealTypeSelector value={mealType} onChange={setMealType} />

          <div className="bg-gray-50 p-4 rounded-md">
            <h3 className="text-sm text-gray-900 mb-2">Valeurs nutritionnelles</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-600">Calories :</div>
              <div className="font-medium text-gray-900">{calculatedCalories} kcal</div>
              <div className="text-gray-600">Protéines :</div>
              <div className="font-medium text-gray-900">{calculatedProtein} g</div>
              <div className="text-gray-600">Lipides :</div>
              <div className="font-medium text-gray-900">{calculatedFat} g</div>
              <div className="text-gray-600">Glucides :</div>
              <div className="font-medium text-gray-900">{calculatedCarbs} g</div>
              <div className="text-gray-600">Fibres :</div>
              <div className="font-medium text-gray-900">{calculatedFiber} g</div>
            </div>
          </div>
        </>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={!selectedFood || quantity <= 0 || submitting}
          className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
        >
          {submitting ? 'Ajout en cours…' : 'Ajouter'}
        </button>
      </div>
    </form>
  );

  const renderManualField = (
    field: keyof ManualFormState,
    label: string,
    options?: { type?: 'text' | 'number'; min?: number; step?: string; required?: boolean },
  ) => {
    const error = manualErrors[field];
    const showError = manualSubmitAttempted && Boolean(error);

    return (
      <div>
        <label htmlFor={field} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
        <input
          id={field}
          type={options?.type ?? 'number'}
          value={manualForm[field] ?? ''}
          min={options?.min}
          step={options?.step}
          required={options?.required}
          onChange={(event) => {
            const value = options?.type === 'text' ? event.target.value : Number(event.target.value);
            setManualForm((current) => ({
              ...current,
              [field]: value,
            }));
          }}
          aria-invalid={showError}
          aria-describedby={showError ? `${field}-error` : undefined}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            showError ? 'border-red-400' : 'border-gray-300'
          }`}
        />
        {showError && (
          <p id={`${field}-error`} className="mt-1 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  };

  const renderManualTab = () => (
    <form onSubmit={handleManualSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          {renderManualField('label', 'Nom de l\'aliment', { type: 'text', required: true })}
        </div>
        {renderManualField('qty_grammes', 'Quantité (g)', { min: 1, step: '1', required: true })}
        {renderManualField('kcal', 'Calories (kcal)', { min: 0, step: '1', required: true })}
        {renderManualField('protein_g', 'Protéines (g)', { min: 0, step: '0.1', required: true })}
        {renderManualField('fat_g', 'Lipides (g)', { min: 0, step: '0.1', required: true })}
        {renderManualField('carbs_g', 'Glucides (g)', { min: 0, step: '0.1', required: true })}
        {renderManualField('fiber_g', 'Fibres (g)', { min: 0, step: '0.1' })}
      </div>

      <MealTypeSelector
        value={manualForm.meal_type}
        onChange={(value) => setManualForm((current) => ({ ...current, meal_type: value }))}
      />

      <div className="rounded-md bg-gray-50 p-4 text-sm text-gray-600">
        Les valeurs saisies correspondent à la portion entrée, pas à 100 g.
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={!isManualFormValid || submitting}
          className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
        >
          {submitting ? 'Ajout en cours…' : 'Ajouter'}
        </button>
      </div>
    </form>
  );

  const renderQuickTab = () => (
    <div className="space-y-4">
      <div className="rounded-md bg-gray-50 p-4 text-sm text-gray-600">
        Sélectionnez un aliment récent puis ajustez la quantité et le repas avant de l’ajouter au {formatRecentDate(date)}.
      </div>

      {recentEntriesLoading && (
        <div className="flex items-center justify-center gap-2 rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement des aliments récents…
        </div>
      )}

      {!recentEntriesLoading && recentEntriesError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {recentEntriesError}
        </div>
      )}

      {!recentEntriesLoading && !recentEntriesError && recentEntries.length === 0 && (
        <div className="rounded-md border border-gray-200 bg-white p-6 text-center text-sm text-gray-600">
          Aucun aliment récent.
        </div>
      )}

      {!recentEntriesLoading && !recentEntriesError && recentEntries.length > 0 && (
        <div className="space-y-3">
          {recentEntries.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-gray-900">{entry.label}</h3>
                    {entry.meal_type && (
                      <span className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">
                        {getMealTypeLabel(entry.meal_type)}
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      Dernier ajout : {formatRecentDate(entry.created_at)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {entry.qty_grammes} g · {Math.round(entry.kcal)} kcal
                  </div>
                  <div className="text-sm text-gray-600">
                    P {entry.protein_g} g · L {entry.fat_g} g · G {entry.carbs_g} g · F {entry.fiber_g} g
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRecentFoodSelect(entry)}
                  className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Utiliser
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedRecentFood && (
        <form onSubmit={handleQuickSubmit} className="space-y-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-blue-900">Pré-remplissage rapide</h3>
              <p className="mt-1 text-sm text-blue-800">{selectedRecentFood.label ?? 'Aliment sans nom'}</p>
            </div>
            <button
              type="button"
              onClick={resetQuickState}
              className="text-sm font-medium text-blue-700 hover:text-blue-900"
            >
              Annuler
            </button>
          </div>

          {selectedRecentFood.qty_grammes <= 0 && (
            <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
              La quantité d’origine était invalide. Le recalcul est basé sur 100 g par défaut.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="quick-label" className="block text-sm font-medium text-gray-700 mb-1">
                Nom de l’aliment
              </label>
              <div id="quick-label" className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-900">
                {selectedRecentFood.label ?? 'Aliment sans nom'}
              </div>
            </div>

            <div>
              <label htmlFor="quick-quantity" className="block text-sm font-medium text-gray-700 mb-1">
                Quantité (g)
              </label>
              <input
                id="quick-quantity"
                type="number"
                value={quickQuantity}
                onChange={(event) => setQuickQuantity(Number(event.target.value))}
                min="1"
                step="1"
                required
                aria-invalid={!isQuickQuantityValid}
                className={`w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isQuickQuantityValid ? 'border-gray-300 bg-white' : 'border-red-400 bg-white'
                }`}
              />
              {!isQuickQuantityValid && (
                <p className="mt-1 text-sm text-red-600">La quantité doit être supérieure à 0.</p>
              )}
            </div>
          </div>

          <MealTypeSelector value={quickMealType} onChange={setQuickMealType} />

          <div className="rounded-md bg-white p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Récapitulatif</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-600">Calories :</div>
              <div className="font-medium text-gray-900">{quickCalories} kcal</div>
              <div className="text-gray-600">Protéines :</div>
              <div className="font-medium text-gray-900">{quickProtein} g</div>
              <div className="text-gray-600">Lipides :</div>
              <div className="font-medium text-gray-900">{quickFat} g</div>
              <div className="text-gray-600">Glucides :</div>
              <div className="font-medium text-gray-900">{quickCarbs} g</div>
              <div className="text-gray-600">Fibres :</div>
              <div className="font-medium text-gray-900">{quickFiber} g</div>
            </div>
          </div>

          <button
            type="submit"
            disabled={!isQuickQuantityValid || submitting}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {submitting ? 'Ajout en cours…' : 'Ajouter au journal'}
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={onClose}
        className="w-full py-2 px-4 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors"
      >
        Fermer
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-8 pt-8 pb-6 border-b border-gray-200">
          <h2 className="text-xl text-gray-900">Ajouter un aliment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Fermer la fenêtre">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="px-6 pt-6">
          <div role="tablist" aria-label="Mode d'ajout d'aliment" className="grid grid-cols-3 gap-2 rounded-lg bg-gray-100 p-1">
            {tabOptions.map((tab, index) => (
              <button
                key={tab.value}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                id={`add-entry-tab-${tab.value}`}
                type="button"
                role="tab"
                tabIndex={activeTab === tab.value ? 0 : -1}
                aria-selected={activeTab === tab.value}
                aria-controls={`add-entry-panel-${tab.value}`}
                onClick={() => {
                  setActiveTab(tab.value);
                  if (tab.value !== 'search') {
                    resetSearchState();
                  }
                  if (tab.value !== 'manual') {
                    setManualSubmitAttempted(false);
                  }
                  if (tab.value !== 'quick') {
                    resetQuickState();
                  }
                }}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  activeTab === tab.value
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          <div
            id={`add-entry-panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`add-entry-tab-${activeTab}`}
          >
            {activeTab === 'search' && renderSearchTab()}
            {activeTab === 'manual' && renderManualTab()}
            {activeTab === 'quick' && renderQuickTab()}
          </div>
        </div>
      </div>
    </div>
  );
}
