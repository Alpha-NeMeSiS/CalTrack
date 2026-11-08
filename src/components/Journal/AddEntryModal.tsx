// Fenêtre d'ajout d'un aliment au journal, en trois onglets :
// - Recherche : favoris et récents (ajout en un tap), recherche Ciqual / Open
//   Food Facts / mes aliments, scanner de code-barres, choix de la quantité ;
// - Saisie manuelle : valeurs saisies à la main, enregistrables dans « Mes
//   aliments » (avec le code-barres d'un produit scanné inconnu) ;
// - Mes aliments : aliments personnels (utiliser, supprimer).
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Star, X } from 'lucide-react';
import { FoodSearch } from '../Foods/FoodSearch';
import { QuickFoods } from '../Foods/QuickFoods';
import { useFoodLibrary } from '../Foods/useFoodLibrary';
import { useAuth } from '../../contexts/useAuth';
import { usePreferences } from '../../contexts/usePreferences';
import { getMealLabel, getVisibleMeals } from '../../utils/preferences';
import { Entry } from '../../lib/supabase';
import type { NormalizedFood } from '../../types/food';
import { parseLocalDate } from '../../utils/date';
import { cleanBarcodeInput, isValidGtin } from '../../utils/barcode';
import { foodLabel, nutritionForQuantity, QuickFood } from '../../utils/foodLibrary';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type AddEntryPayload = Pick<
  Entry,
  'food_id' | 'label' | 'qty_grammes' | 'kcal' | 'protein_g' | 'fat_g' | 'carbs_g' | 'fiber_g' | 'meal_type'
>;
type AddEntryMode = 'search' | 'manual' | 'mine';
/** Les valeurs de la saisie manuelle portent sur la quantité indiquée ou sur 100 g (étiquette) */
type ValuesBasis = 'portion' | 'per100';

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

const tabOptions: Array<{ value: AddEntryMode; label: string }> = [
  { value: 'search', label: 'Recherche' },
  { value: 'manual', label: 'Saisie manuelle' },
  { value: 'mine', label: 'Mes aliments' },
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

const ADD_ERROR = "L'ajout a échoué. Vérifiez votre connexion puis réessayez.";

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function formatEntryDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(parseLocalDate(value));
}

function MealTypeSelector({
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

export function AddEntryModal({ date, onClose, onAdd }: AddEntryModalProps) {
  const { user } = useAuth();
  const { preferences } = usePreferences();
  const library = useFoodLibrary(user?.id);
  const [activeTab, setActiveTab] = useState<AddEntryMode>('search');
  const [selectedFood, setSelectedFood] = useState<NormalizedFood | null>(null);
  const [quantity, setQuantity] = useState<number>(100);
  const [mealType, setMealType] = useState<MealType | undefined>(undefined);
  const [manualForm, setManualForm] = useState<ManualFormState>(defaultManualForm);
  const [manualSubmitAttempted, setManualSubmitAttempted] = useState(false);
  const [valuesBasis, setValuesBasis] = useState<ValuesBasis>('portion');
  const [saveToMyFoods, setSaveToMyFoods] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [manualFromScan, setManualFromScan] = useState(false);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [libraryMessage, setLibraryMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const isSearchQuantityValid = Number.isFinite(quantity) && quantity > 0;
  const calculated = selectedFood
    ? nutritionForQuantity(selectedFood, quantity)
    : { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0 };

  const manualErrors = useMemo(() => {
    const errors: Partial<Record<keyof ManualFormState, string>> = {};

    if (!manualForm.label.trim()) {
      errors.label = 'Le nom de l\'aliment est requis.';
    }

    if (!Number.isFinite(manualForm.qty_grammes) || manualForm.qty_grammes <= 0) {
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
      if (!Number.isFinite(manualForm[field])) {
        errors[field] = 'Veuillez saisir un nombre.';
      } else if (manualForm[field] < 0) {
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

  const resetManualExtras = () => {
    setSaveToMyFoods(false);
    setManualBarcode('');
    setManualFromScan(false);
    setValuesBasis('portion');
    setBarcodeError(null);
  };

  const switchTab = (tab: AddEntryMode) => {
    setActiveTab(tab);
    setSubmitError(null);
    setLibraryMessage(null);
    setConfirmDeleteId(null);
    if (tab !== 'search') resetSearchState();
    if (tab !== 'manual') {
      setManualSubmitAttempted(false);
      resetManualExtras();
    }
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

    switchTab(tabOptions[nextIndex].value);
    tabRefs.current[nextIndex]?.focus();
  };

  const submitEntry = async (entry: AddEntryPayload) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const success = await onAdd(entry);
      if (success) {
        onClose();
      } else {
        // Auparavant : aucun retour visible, le bouton revenait simplement à « Ajouter »
        setSubmitError(ADD_ERROR);
      }
      return success;
    } catch (error) {
      console.error("Erreur lors de l'ajout", error);
      setSubmitError(ADD_ERROR);
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  // --- Recherche ------------------------------------------------------------

  const selectFood = (food: NormalizedFood, grams?: number, meal?: MealType) => {
    // Aliment déjà connu (favori, journal) : sa quantité et son repas habituels
    const usual = grams === undefined ? library.usualFor(food) : null;
    setSelectedFood(food);
    // Quantité habituelle, sinon portion du fabricant (ex : 1 pot de 125 g), sinon 100 g
    setQuantity(grams ?? usual?.usualQty ?? food.servingGrams ?? 100);
    setMealType(meal ?? usual?.usualMeal);
    setLibraryMessage(null);
  };

  const handleSearchSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedFood || !isSearchQuantityValid) {
      return;
    }

    const id =
      selectedFood.foodId ??
      (selectedFood.source === 'ciqual' && selectedFood.extCode
        ? `ciqual:${selectedFood.extCode}`
        : selectedFood.source === 'off' && selectedFood.offCode
          ? `off:${selectedFood.offCode}`
          : undefined);

    await submitEntry({
      ...(id ? { food_id: id } : {}),
      label: foodLabel(selectedFood),
      qty_grammes: quantity,
      ...calculated,
      meal_type: mealType,
    });
  };

  /** Ajout en un tap : quantité et repas habituels */
  const handleQuickAdd = async (item: QuickFood) => {
    await submitEntry({
      label: item.label,
      qty_grammes: item.usualQty,
      ...nutritionForQuantity(item.food, item.usualQty),
      meal_type: item.usualMeal,
    });
  };

  const toggleFavorite = async (food: NormalizedFood, grams: number) => {
    setLibraryMessage(null);
    try {
      await library.toggleFavorite(food, Number.isFinite(grams) && grams > 0 ? grams : 100);
    } catch (error) {
      console.error('Erreur sur les favoris', error);
      setLibraryMessage('Les favoris n’ont pas pu être mis à jour. Réessayez.');
    }
  };

  /** Produit scanné inconnu : saisie manuelle pré-remplie, enregistrée dans mes aliments */
  const handleCreateFood = (draft: { barcode: string; name?: string }) => {
    switchTab('manual');
    setManualForm({ ...defaultManualForm, label: draft.name ?? '' });
    setSaveToMyFoods(true);
    setManualBarcode(draft.barcode);
    setManualFromScan(true);
    setValuesBasis('per100');
  };

  // --- Saisie manuelle --------------------------------------------------------

  /** Valeurs de l'entrée pour la quantité indiquée */
  const manualEntryValues = () => {
    const ratio = valuesBasis === 'per100' ? manualForm.qty_grammes / 100 : 1;
    return {
      kcal: valuesBasis === 'per100' ? Math.round(manualForm.kcal * ratio) : manualForm.kcal,
      protein_g: valuesBasis === 'per100' ? roundToOneDecimal(manualForm.protein_g * ratio) : manualForm.protein_g,
      fat_g: valuesBasis === 'per100' ? roundToOneDecimal(manualForm.fat_g * ratio) : manualForm.fat_g,
      carbs_g: valuesBasis === 'per100' ? roundToOneDecimal(manualForm.carbs_g * ratio) : manualForm.carbs_g,
      fiber_g: valuesBasis === 'per100' ? roundToOneDecimal(manualForm.fiber_g * ratio) : manualForm.fiber_g,
    };
  };

  const handleManualSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setManualSubmitAttempted(true);
    setBarcodeError(null);

    if (!isManualFormValid) {
      return;
    }

    const barcode = cleanBarcodeInput(manualBarcode);
    if (saveToMyFoods && barcode && !isValidGtin(barcode)) {
      setBarcodeError('Code-barres invalide : vérifiez les 8, 12 ou 13 chiffres, ou laissez le champ vide.');
      return;
    }

    let foodId: string | undefined;
    if (saveToMyFoods) {
      setSubmitting(true);
      try {
        const saved = await library.savePersonal(
          {
            name: manualForm.label,
            // Valeurs de l'étiquette : déjà pour 100 g
            qty_grammes: valuesBasis === 'per100' ? 100 : manualForm.qty_grammes,
            kcal: manualForm.kcal,
            protein_g: manualForm.protein_g,
            fat_g: manualForm.fat_g,
            carbs_g: manualForm.carbs_g,
            fiber_g: manualForm.fiber_g,
          },
          saveToMyFoods && barcode ? barcode : null
        );
        foodId = saved.id;
      } catch (error) {
        console.error("Erreur lors de l'enregistrement de l'aliment", error);
        setSubmitError("L'aliment n'a pas pu être enregistré dans vos aliments. Réessayez, ou décochez la case pour l'ajouter seulement au journal.");
        setSubmitting(false);
        return;
      }
    }

    await submitEntry({
      ...(foodId ? { food_id: foodId } : {}),
      label: manualForm.label.trim(),
      qty_grammes: manualForm.qty_grammes,
      ...manualEntryValues(),
      meal_type: manualForm.meal_type,
    });
  };

  // --- Mes aliments -----------------------------------------------------------

  const handleUsePersonal = (food: NormalizedFood) => {
    switchTab('search');
    selectFood(food);
  };

  const handleDeletePersonal = async (food: NormalizedFood) => {
    if (!food.foodId) return;
    setLibraryMessage(null);
    try {
      await library.deletePersonal(food.foodId);
      setConfirmDeleteId(null);
    } catch (error) {
      console.error("Erreur lors de la suppression de l'aliment", error);
      setLibraryMessage("L'aliment n'a pas pu être supprimé. Réessayez.");
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, submitting]);

  const libraryAlert = libraryMessage && (
    <p role="alert" className="rounded-md border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
      {libraryMessage}
    </p>
  );

  const renderSearchTab = () => {
    const isFavorite = selectedFood ? library.isFavorite(selectedFood) : false;
    return (
      <form onSubmit={handleSearchSubmit} className="space-y-6">
        <div>
          <label className="field-label mb-2">Aliment</label>
          <FoodSearch
            onSelect={(food) => selectFood(food)}
            personalFoods={library.personalFoods}
            onCreateFood={handleCreateFood}
            idleContent={
              !selectedFood && (
                <QuickFoods
                  favorites={library.favoriteFoods}
                  recents={library.recentFoods}
                  loading={library.loading}
                  error={library.error}
                  mealLabel={(meal) => getMealLabel(preferences, meal)}
                  onPick={(item) => selectFood(item.food, item.usualQty, item.usualMeal)}
                  onQuickAdd={handleQuickAdd}
                  onToggleFavorite={(item) => toggleFavorite(item.food, item.usualQty)}
                  disabled={submitting}
                />
              )
            }
          />
          {selectedFood && (
            <div className="mt-3 flex items-center gap-3 rounded-md border border-primary-200 bg-primary-50 p-3">
              {selectedFood.imageUrl && (
                <img
                  src={selectedFood.imageUrl}
                  alt=""
                  className="h-12 w-12 flex-shrink-0 rounded object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-medium text-primary-900">{foodLabel(selectedFood)}</div>
                <div className="mt-1 text-sm text-primary-700">
                  {Math.round(selectedFood.kcal_per_100g)} kcal pour 100 g
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleFavorite(selectedFood, quantity)}
                aria-pressed={isFavorite}
                aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                className="flex-shrink-0 rounded-md p-2 text-primary-400 hover:bg-primary-100 hover:text-warning-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
              >
                <Star className={`h-5 w-5 ${isFavorite ? 'fill-warning-400 text-warning-500' : ''}`} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        {libraryAlert}

        {selectedFood && (
          <>
            <div>
              <label htmlFor="quantity" className="field-label mb-1">
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
                className="w-full px-3 py-2 field-input"
              />
              {/* Portions rapides : évite de taper la quantité */}
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Portions rapides">
                {selectedFood.servingGrams && (
                  <>
                    <button
                      type="button"
                      onClick={() => setQuantity(selectedFood.servingGrams!)}
                      aria-pressed={quantity === selectedFood.servingGrams}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${quantity === selectedFood.servingGrams ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-line-strong text-body hover:bg-surface-muted'}`}
                    >
                      1 portion ({selectedFood.servingGrams} g)
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuantity(selectedFood.servingGrams! * 2)}
                      aria-pressed={quantity === selectedFood.servingGrams * 2}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${quantity === selectedFood.servingGrams * 2 ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-line-strong text-body hover:bg-surface-muted'}`}
                    >
                      2 portions
                    </button>
                  </>
                )}
                {[50, 100, 150, 200].map((grams) => (
                  <button
                    key={grams}
                    type="button"
                    onClick={() => setQuantity(grams)}
                    aria-pressed={quantity === grams}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${quantity === grams ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-line-strong text-body hover:bg-surface-muted'}`}
                  >
                    {grams} g
                  </button>
                ))}
              </div>
            </div>

            <MealTypeSelector value={mealType} onChange={setMealType} />

            <div className="bg-surface-muted p-4 rounded-md">
              <h3 className="text-sm text-ink mb-2">Valeurs nutritionnelles</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted">Calories :</div>
                <div className="font-medium text-ink">{calculated.kcal} kcal</div>
                <div className="text-muted">Protéines :</div>
                <div className="font-medium text-ink">{calculated.protein_g} g</div>
                <div className="text-muted">Lipides :</div>
                <div className="font-medium text-ink">{calculated.fat_g} g</div>
                <div className="text-muted">Glucides :</div>
                <div className="font-medium text-ink">{calculated.carbs_g} g</div>
                <div className="text-muted">Fibres :</div>
                <div className="font-medium text-ink">{calculated.fiber_g} g</div>
              </div>
            </div>
          </>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 px-4 btn-secondary font-medium rounded-md"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={!selectedFood || !isSearchQuantityValid || submitting}
            className="flex-1 py-2 px-4 btn-primary font-medium rounded-md"
          >
            {submitting ? 'Ajout en cours…' : 'Ajouter'}
          </button>
        </div>
      </form>
    );
  };

  const renderManualField = (
    field: keyof ManualFormState,
    label: string,
    options?: { type?: 'text' | 'number'; min?: number; step?: string; required?: boolean },
  ) => {
    const error = manualErrors[field];
    const showError = manualSubmitAttempted && Boolean(error);

    return (
      <div>
        <label htmlFor={field} className="field-label mb-1">
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
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-600 ${
            showError ? 'border-danger-400' : 'border-line-strong'
          }`}
        />
        {showError && (
          <p id={`${field}-error`} className="mt-1 text-sm text-danger-700">
            {error}
          </p>
        )}
      </div>
    );
  };

  const renderManualTab = () => {
    const totals = manualEntryValues();
    return (
      <form onSubmit={handleManualSubmit} className="space-y-6">
        {manualFromScan && (
          <p className="rounded-md border border-primary-200 bg-primary-50 p-3 text-sm text-primary-800">
            Produit scanné : recopiez les valeurs de l’étiquette pour 100 g, puis indiquez la quantité mangée. Il sera
            enregistré dans vos aliments et reconnu au prochain scan.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            {renderManualField('label', 'Nom de l\'aliment', { type: 'text', required: true })}
          </div>
          {renderManualField('qty_grammes', 'Quantité (g)', { min: 1, step: '1', required: true })}

          <fieldset className="md:col-span-2">
            <legend className="mb-2 field-label">Valeurs saisies pour</legend>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'portion' as const, label: 'La quantité indiquée' },
                { value: 'per100' as const, label: '100 g (étiquette)' },
              ].map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border-2 px-3 py-2 text-sm ${
                    valuesBasis === option.value ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-line-strong text-body'
                  }`}
                >
                  <input
                    type="radio"
                    name="values-basis"
                    value={option.value}
                    checked={valuesBasis === option.value}
                    onChange={() => setValuesBasis(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

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

        <div className="space-y-3 rounded-md border border-line p-4">
          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={saveToMyFoods}
              onChange={(event) => setSaveToMyFoods(event.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Enregistrer dans mes aliments</span>
              <span className="block text-xs text-subtle">Pour le retrouver dans la recherche et l’ajouter en un tap.</span>
            </span>
          </label>
          {saveToMyFoods && (
            <div>
              <label htmlFor="manual-barcode" className="mb-1 field-label">
                Code-barres
              </label>
              <input
                id="manual-barcode"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Facultatif (ex. 3017620422003)"
                value={manualBarcode}
                onChange={(event) => setManualBarcode(event.target.value)}
                aria-invalid={barcodeError ? true : undefined}
                aria-describedby={barcodeError ? 'manual-barcode-error' : 'manual-barcode-hint'}
                className={`w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-600 ${
                  barcodeError ? 'border-danger-400' : 'border-line-strong'
                }`}
              />
              {barcodeError ? (
                <p id="manual-barcode-error" className="mt-1 text-sm text-danger-700">
                  {barcodeError}
                </p>
              ) : (
                <p id="manual-barcode-hint" className="mt-1 text-xs text-subtle">
                  Le produit sera reconnu quand vous le scannerez.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="rounded-md bg-surface-muted p-4 text-sm text-muted">
          {valuesBasis === 'per100'
            ? `Pour ${Number.isFinite(manualForm.qty_grammes) ? manualForm.qty_grammes : 0} g : ${totals.kcal} kcal · P ${totals.protein_g} g · L ${totals.fat_g} g · G ${totals.carbs_g} g.`
            : 'Les valeurs saisies correspondent à la quantité indiquée, pas à 100 g.'}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 px-4 btn-secondary font-medium rounded-md"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={!isManualFormValid || submitting}
            className="flex-1 py-2 px-4 btn-primary font-medium rounded-md"
          >
            {submitting ? 'Ajout en cours…' : 'Ajouter'}
          </button>
        </div>
      </form>
    );
  };

  const renderMineTab = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Vos aliments personnels apparaissent dans la recherche et sont reconnus au scan grâce à leur code-barres.
      </p>
      <button
        type="button"
        onClick={() => {
          switchTab('manual');
          setManualForm(defaultManualForm);
          setSaveToMyFoods(true);
          setValuesBasis('per100');
        }}
        className="rounded-md border border-primary-600 px-4 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50"
      >
        Créer un aliment
      </button>

      {libraryAlert}

      {library.loading ? (
        <p className="text-sm text-subtle">Chargement de vos aliments…</p>
      ) : library.personalFoods.length === 0 ? (
        <p className="rounded-md border border-dashed border-line-strong p-4 text-center text-sm text-subtle">
          Aucun aliment personnel pour l’instant. Créez-en un, ou scannez un produit introuvable.
        </p>
      ) : (
        <ul aria-label="Mes aliments" className="divide-y divide-line-subtle rounded-md border border-line">
          {library.personalFoods.map((food) => (
            <li key={food.foodId} className="flex flex-wrap items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{food.name}</div>
                <div className="text-xs text-subtle">{Math.round(food.kcal_per_100g)} kcal pour 100 g</div>
                {food.barcode && <div className="text-xs text-subtle">Code-barres {food.barcode}</div>}
              </div>
              {confirmDeleteId === food.foodId ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleDeletePersonal(food)}
                    aria-label={`Confirmer la suppression de « ${food.name} »`}
                    className="rounded-md btn-danger px-3 py-1.5 text-sm font-medium"
                  >
                    Supprimer
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="rounded-md btn-secondary px-3 py-1.5 text-sm"
                  >
                    Annuler
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleUsePersonal(food)}
                    aria-label={`Utiliser « ${food.name} »`}
                    className="rounded-md btn-primary px-3 py-1.5 text-sm font-medium"
                  >
                    Utiliser
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(food.foodId ?? null)}
                    aria-label={`Supprimer « ${food.name} »`}
                    className="rounded-md btn-secondary px-3 py-1.5 text-sm"
                  >
                    Supprimer
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onClose}
        className="w-full py-2 px-4 btn-secondary font-medium rounded-md"
      >
        Fermer
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-entry-title"
        className="bg-surface rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-8 pt-8 pb-6 border-b border-line">
          <div>
            <h2 id="add-entry-title" className="text-xl text-ink">Ajouter un aliment</h2>
            <p className="mt-1 text-sm text-subtle first-letter:uppercase">{formatEntryDate(date)}</p>
          </div>
          <button onClick={onClose} className="text-subtle hover:text-muted transition-colors" aria-label="Fermer la fenêtre">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="px-6 pt-6">
          <div role="tablist" aria-label="Mode d'ajout d'aliment" className="grid grid-cols-3 gap-2 rounded-lg bg-surface-sunken p-1">
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
                onClick={() => switchTab(tab.value)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 ${
                  activeTab === tab.value
                    ? 'bg-surface text-primary-700 shadow-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {submitError && (
            <div role="alert" className="mb-4 rounded-md border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
              {submitError}
            </div>
          )}
          <div
            id={`add-entry-panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`add-entry-tab-${activeTab}`}
          >
            {activeTab === 'search' && renderSearchTab()}
            {activeTab === 'manual' && renderManualTab()}
            {activeTab === 'mine' && renderMineTab()}
          </div>
        </div>
      </div>
    </div>
  );
}
