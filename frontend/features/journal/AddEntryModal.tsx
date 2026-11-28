// Fenêtre d'ajout d'un aliment au journal, en quatre onglets :
// - Recherche : favoris et récents (ajout en un tap), recherche Ciqual / Open
//   Food Facts / mes aliments, scanner de code-barres, choix de la quantité ;
// - Saisie manuelle : valeurs saisies à la main, enregistrables dans « Mes
//   aliments » (avec le code-barres d'un produit scanné inconnu) ;
// - Mes aliments : aliments personnels (utiliser, supprimer) ;
// - Recettes : plats maison en parts (créer, modifier, ajouter en parts ou en grammes).
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Star, X } from 'lucide-react';
import { FoodSearch } from '../foods/FoodSearch';
import { QuickFoods } from '../foods/QuickFoods';
import { useFoodLibrary } from '../foods/useFoodLibrary';
import { useAuth } from '../../app/contexts/useAuth';
import { usePreferences } from '../../app/contexts/usePreferences';
import { getMealLabel } from '../settings/preferences';
import type { AddEntryPayload, MealType } from './entries';
import { servingUnit } from './entries';
import { MealTypeSelector } from './MealTypeSelector';
import { RecipesTab } from '../recipes/RecipesTab';
import { useModalFocus } from '../../shared/ui/useModalFocus';
import type { FoodDraft, NormalizedFood, NutritionPer100 } from '../foods/types';
import { parseLocalDate } from '../../shared/date';
import { cleanBarcodeInput, isValidGtin } from '../foods/barcode';
import { nutritionOf } from '../foods/similarProducts';
import { foodLabel, nutritionForQuantity, QuickFood } from '../foods/foodLibrary';

type AddEntryMode = 'search' | 'manual' | 'mine' | 'recipes';
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
  { value: 'recipes', label: 'Recettes' },
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
  // Valeurs pré-remplies d'après des produits proches (ou aliment estimé à corriger)
  const [manualEstimate, setManualEstimate] = useState<{ values: NutritionPer100; source: string } | null>(null);
  const [manualCorrection, setManualCorrection] = useState(false);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [libraryMessage, setLibraryMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Ajouts à la suite : la fenêtre reste ouverte, confirmation du dernier ajout
  const [lastAdded, setLastAdded] = useState<{ label: string; kcal: number; meal?: MealType } | null>(null);
  // Repas du dernier ajout, proposé pour l'aliment suivant
  const [lastMeal, setLastMeal] = useState<MealType | undefined>(undefined);
  const [searchFocusKey, setSearchFocusKey] = useState<number | undefined>(undefined);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLParagraphElement | null>(null);

  // Nouvel ajout : la fenêtre remonte pour montrer la confirmation (long formulaire sur mobile).
  // Si le bouton utilisé a disparu ou s'est désactivé, le focus clavier reste dans la
  // fenêtre, sur la confirmation, au lieu de repartir en haut de la page.
  useEffect(() => {
    if (!lastAdded) return;
    dialogRef.current?.scrollTo?.({ top: 0 });
    // Vérifié après les mises à jour qui suivent l'ajout (ex : retour à la liste des recettes)
    const timer = window.setTimeout(() => {
      const active = document.activeElement as HTMLElement | null;
      const focusLost = !active || !dialogRef.current?.contains(active) || (active as HTMLButtonElement).disabled;
      if (focusLost) statusRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [lastAdded]);

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
    setManualEstimate(null);
    setManualCorrection(false);
    setValuesBasis('portion');
    setBarcodeError(null);
  };

  const switchTab = (tab: AddEntryMode) => {
    setActiveTab(tab);
    setSubmitError(null);
    setLastAdded(null);
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
        // La fenêtre reste ouverte pour l'aliment suivant ; la croix la ferme
        setLastAdded({ label: entry.label ?? 'Aliment', kcal: entry.kcal, meal: entry.meal_type });
        setLastMeal(entry.meal_type);
      } else {
        // Auparavant : aucun retour visible, le bouton revenait simplement à « Ajouter »
        setLastAdded(null);
        setSubmitError(ADD_ERROR);
      }
      return success;
    } catch (error) {
      console.error("Erreur lors de l'ajout", error);
      setLastAdded(null);
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
    // Repas du dernier ajout d'abord (on note un repas en entier), puis l'habitude
    setMealType(lastMeal ?? meal ?? usual?.usualMeal);
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

    const added = await submitEntry({
      ...(id ? { food_id: id } : {}),
      label: foodLabel(selectedFood),
      qty_grammes: quantity,
      ...calculated,
      meal_type: mealType,
    });
    if (added) {
      // Prêt pour l'aliment suivant : sélection retirée, champ de recherche actif
      setSelectedFood(null);
      setQuantity(100);
      setSearchFocusKey((key) => (key ?? 0) + 1);
    }
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

  /**
   * Produit scanné inconnu ou sans valeurs : saisie manuelle pré-remplie (valeurs
   * estimées éventuelles), enregistrée dans mes aliments.
   */
  const handleCreateFood = (draft: FoodDraft) => {
    switchTab('manual');
    const values = draft.estimate?.values;
    setManualForm({
      ...defaultManualForm,
      label: draft.name ?? '',
      qty_grammes: draft.servingGrams ?? defaultManualForm.qty_grammes,
      meal_type: lastMeal,
      ...(values
        ? {
            kcal: values.kcal_per_100g,
            protein_g: values.protein_g,
            fat_g: values.fat_g,
            carbs_g: values.carbs_g,
            fiber_g: values.fiber_g,
          }
        : {}),
    });
    setSaveToMyFoods(true);
    setManualBarcode(draft.barcode);
    setManualFromScan(true);
    setManualEstimate(draft.estimate ?? null);
    setManualCorrection(Boolean(draft.correction));
    setValuesBasis('per100');
  };

  /** Aliment estimé choisi : correction avec les valeurs de l'étiquette */
  const handleCorrectEstimated = (food: NormalizedFood) => {
    handleCreateFood({
      barcode: food.barcode ?? '',
      name: food.name,
      estimate: { values: nutritionOf(food), source: '' },
      correction: true,
    });
  };

  /** Valeurs pré-remplies d'une estimation, enregistrées telles quelles (base 100 g inchangée) */
  const keepsEstimate = () => {
    if (!manualEstimate || valuesBasis !== 'per100') return false;
    const { values } = manualEstimate;
    return (
      manualForm.kcal === values.kcal_per_100g &&
      manualForm.protein_g === values.protein_g &&
      manualForm.fat_g === values.fat_g &&
      manualForm.carbs_g === values.carbs_g &&
      manualForm.fiber_g === values.fiber_g
    );
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
          saveToMyFoods && barcode ? barcode : null,
          keepsEstimate()
        );
        foodId = saved.id;
      } catch (error) {
        console.error("Erreur lors de l'enregistrement de l'aliment", error);
        setSubmitError("L'aliment n'a pas pu être enregistré dans vos aliments. Réessayez, ou décochez la case pour l'ajouter seulement au journal.");
        setSubmitting(false);
        return;
      }
    }

    const added = await submitEntry({
      ...(foodId ? { food_id: foodId } : {}),
      label: manualForm.label.trim(),
      qty_grammes: manualForm.qty_grammes,
      ...manualEntryValues(),
      meal_type: manualForm.meal_type,
    });
    if (added) {
      // Formulaire vidé pour l'aliment suivant, même repas ; le clavier repart du nom
      setManualForm({ ...defaultManualForm, meal_type: manualForm.meal_type });
      setManualSubmitAttempted(false);
      resetManualExtras();
      document.getElementById('label')?.focus();
    }
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

  // Échap, piège de focus (Tab reste dans la fenêtre), restauration du focus au
  // bouton d'origine et verrou du défilement de la page. Échap est désactivé
  // pendant un enregistrement, pour ne pas fermer la fenêtre au milieu.
  useModalFocus(dialogRef, onClose, { closeOnEscape: !submitting });

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
          {/* Titre visuel : le champ de FoodSearch porte son propre aria-label */}
          <span className="field-label mb-2 block">Aliment</span>
          <FoodSearch
            onSelect={(food) => selectFood(food)}
            focusKey={searchFocusKey}
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
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-primary-900">{foodLabel(selectedFood)}</span>
                  {selectedFood.estimated && <span className="badge badge-warning">Estimé</span>}
                </div>
                <div className="mt-1 text-sm text-primary-700">
                  {Math.round(selectedFood.kcal_per_100g)} kcal pour 100 g
                </div>
                {selectedFood.estimated && selectedFood.barcode && (
                  <button
                    type="button"
                    onClick={() => handleCorrectEstimated(selectedFood)}
                    className="mt-2 rounded-md text-sm font-medium text-primary-700 underline underline-offset-2 hover:text-primary-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  >
                    Corriger avec l’étiquette
                  </button>
                )}
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
                      1 portion ({selectedFood.servingGrams} {servingUnit(selectedFood.servingLabel)})
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
              <h3 className="section-label mb-2">Valeurs nutritionnelles</h3>
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
        {manualCorrection ? (
          <p className="rounded-md border border-warning-200 bg-warning-50 p-3 text-sm text-warning-900">
            Valeurs estimées : remplacez-les par celles de l’étiquette.
          </p>
        ) : manualEstimate ? (
          <p className="rounded-md border border-warning-200 bg-warning-50 p-3 text-sm text-warning-900">
            <strong>Valeurs estimées</strong> d’après {manualEstimate.source}. Corrigez-les avec l’étiquette si vous
            l’avez. Le produit sera enregistré dans vos aliments et reconnu au prochain scan.
          </p>
        ) : manualFromScan && (
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
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink">{food.name}</span>
                  {food.estimated && <span className="badge badge-warning shrink-0">Estimé</span>}
                </div>
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
                    Confirmer
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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-entry-title"
        className="bg-surface rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-8 pt-8 pb-6 border-b border-line">
          <div>
            <h2 id="add-entry-title" className="card-title">Ajouter un aliment</h2>
            <p className="mt-1 text-sm text-subtle first-letter:uppercase">{formatEntryDate(date)}</p>
          </div>
          <button onClick={onClose} className="text-subtle hover:text-muted transition-colors" aria-label="Fermer la fenêtre">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="px-6 pt-6">
          <div role="tablist" aria-label="Mode d'ajout d'aliment" className="grid grid-cols-4 gap-1 rounded-lg bg-surface-sunken p-1 sm:gap-2">
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
                className={`rounded-md px-1 py-2 text-xs font-medium transition-colors sm:px-3 sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 ${
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
          {lastAdded && (
            <p
              ref={statusRef}
              role="status"
              tabIndex={-1}
              className="mb-4 rounded-md border border-success-200 bg-success-50 px-3 py-2 text-sm text-success-800 focus:outline-none"
            >
              ✓ {lastAdded.label} ajouté
              {lastAdded.meal ? ` · ${getMealLabel(preferences, lastAdded.meal)}` : ''} · {Math.round(lastAdded.kcal)} kcal
            </p>
          )}
          <div
            id={`add-entry-panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`add-entry-tab-${activeTab}`}
          >
            {activeTab === 'search' && renderSearchTab()}
            {activeTab === 'manual' && renderManualTab()}
            {activeTab === 'mine' && renderMineTab()}
            {activeTab === 'recipes' && (
              <RecipesTab
                userId={user?.id}
                recentEntries={library.recentEntries}
                personalFoods={library.personalFoods}
                disabled={submitting}
                lastMeal={lastMeal}
                onAdd={submitEntry}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
