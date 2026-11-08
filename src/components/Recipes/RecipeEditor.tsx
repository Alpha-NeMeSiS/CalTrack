// Création ou modification d'une recette : nom, parts, poids cuit facultatif,
// ingrédients (ajoutés depuis la recherche d'aliments) et totaux en direct.
import { useState } from 'react';
import { ChevronLeft, Minus, Plus, X } from 'lucide-react';
import type { Recipe } from '../../lib/supabase';
import type { NormalizedFood } from '../../types/food';
import { foodLabel } from '../../utils/foodLibrary';
import { formatNumber } from '../../utils/format';
import {
  IngredientValues,
  portionByServings,
  RECIPE_LIMITS,
  RecipeDraft,
  recipeTotals,
  recipeToDraft,
  validateRecipe,
} from '../../utils/recipes';
import { recipeErrorMessage } from '../../services/recipes';
import { FoodSearch } from '../Foods/FoodSearch';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';

interface RecipeEditorProps {
  initial?: Recipe;
  personalFoods?: NormalizedFood[];
  onSave: (draft: RecipeDraft) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel: () => void;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Copie des valeurs pour 100 g d'un aliment trouvé dans la recherche */
function toIngredient(food: NormalizedFood, qty: number): IngredientValues {
  return {
    label: foodLabel(food).slice(0, 160),
    qty_g: qty,
    kcal_per_100g: round1(food.kcal_per_100g),
    protein_g: round1(food.protein_g),
    fat_g: round1(food.fat_g),
    carbs_g: round1(food.carbs_g),
    fiber_g: round1(food.fiber_g ?? 0),
  };
}

const macroLine = (values: { protein_g: number; fat_g: number; carbs_g: number; fiber_g: number }) =>
  `P ${formatNumber(values.protein_g)} g · L ${formatNumber(values.fat_g)} g · G ${formatNumber(values.carbs_g)} g · F ${formatNumber(values.fiber_g)} g`;

export function RecipeEditor({ initial, personalFoods, onSave, onDelete, onCancel }: RecipeEditorProps) {
  const start = initial ? recipeToDraft(initial) : null;
  const [name, setName] = useState(start?.name ?? '');
  const [servings, setServings] = useState(start?.servings ?? 4);
  const [cookedWeight, setCookedWeight] = useState(start?.cooked_weight_g ? String(start.cooked_weight_g) : '');
  const [ingredients, setIngredients] = useState<IngredientValues[]>(start?.ingredients ?? []);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<NormalizedFood | null>(null);
  const [pickedQty, setPickedQty] = useState('100');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const cooked = cookedWeight.trim() === '' ? null : Number(cookedWeight.replace(',', '.'));
  const draft: RecipeDraft = { id: initial?.id, name, servings, cooked_weight_g: cooked, ingredients };
  const totals = recipeTotals(ingredients);
  const perServing = ingredients.length > 0 ? portionByServings(draft, 1) : null;
  const pickedQtyValue = Number(pickedQty.replace(',', '.'));
  const canAddPicked = picked !== null && Number.isFinite(pickedQtyValue) && pickedQtyValue > 0 && pickedQtyValue <= RECIPE_LIMITS.qtyMax;

  const updateQty = (index: number, value: string) => {
    const qty = value.trim() === '' ? Number.NaN : Number(value.replace(',', '.'));
    setIngredients((current) => current.map((item, i) => (i === index ? { ...item, qty_g: qty } : item)));
  };

  const addPicked = () => {
    if (!picked || !canAddPicked) return;
    setIngredients((current) => [...current, toIngredient(picked, pickedQtyValue)]);
    setPicked(null);
    setPickedQty('100');
    setPicking(false);
    setError(null);
  };

  const handleSave = async () => {
    const problem = validateRecipe(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
    } catch (err) {
      console.error("Erreur d'enregistrement de la recette", err);
      setError(recipeErrorMessage(err, name));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setSaving(true);
    setError(null);
    try {
      await onDelete();
    } catch (err) {
      console.error('Erreur de suppression de la recette', err);
      setError('La recette n’a pas pu être supprimée. Réessayez.');
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} className="text-primary-700" aria-label="Retour aux recettes">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Recettes
        </Button>
        <h3 className="card-title">{initial ? 'Modifier la recette' : 'Nouvelle recette'}</h3>
      </div>

      <Field label="Nom de la recette" value={name} maxLength={RECIPE_LIMITS.nameMax} onChange={(e) => setName(e.target.value)} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <span id="servings-label" className="field-label mb-1">
            Nombre de parts
          </span>
          <div className="flex items-center gap-2" role="group" aria-labelledby="servings-label">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setServings((n) => Math.max(1, n - 1))}
              disabled={servings <= 1}
              aria-label="Retirer une part"
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </Button>
            <span className="flex-1 text-center text-lg font-semibold text-ink" aria-live="polite">
              {servings}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setServings((n) => Math.min(RECIPE_LIMITS.servingsMax, n + 1))}
              disabled={servings >= RECIPE_LIMITS.servingsMax}
              aria-label="Ajouter une part"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <Field
          label="Poids cuit (g)"
          type="number"
          inputMode="numeric"
          min={1}
          max={RECIPE_LIMITS.cookedMax}
          value={cookedWeight}
          onChange={(e) => setCookedWeight(e.target.value)}
          placeholder="Facultatif"
        />
      </div>
      <p className="-mt-3 text-xs text-subtle">
        Poids cuit facultatif : pesez la casserole après cuisson pour pouvoir ajouter des grammes.
      </p>

      <section aria-labelledby="ingredients-title">
        <h4 id="ingredients-title" className="section-label mb-2">
          Ingrédients
        </h4>
        {ingredients.length === 0 ? (
          <p className="rounded-xl bg-surface-muted p-3 text-sm text-muted">Aucun ingrédient pour l’instant.</p>
        ) : (
          <ul className="divide-y divide-line-subtle rounded-xl border border-line-subtle">
            {ingredients.map((item, index) => (
              <li key={`${item.label}-${index}`} className="flex items-center gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-ink">{item.label}</div>
                  <div className="text-xs text-subtle">
                    {Number.isFinite(item.qty_g) ? `${formatNumber(Math.round((item.kcal_per_100g * item.qty_g) / 100))} kcal` : '—'}
                  </div>
                </div>
                <label className="flex items-center gap-1 text-sm text-muted">
                  <input
                    aria-label={`Quantité de « ${item.label} » en grammes`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={RECIPE_LIMITS.qtyMax}
                    value={Number.isFinite(item.qty_g) ? item.qty_g : ''}
                    onChange={(e) => updateQty(index, e.target.value)}
                    className="field-input w-20 px-2 py-1 text-right"
                  />
                  g
                </label>
                <button
                  type="button"
                  onClick={() => setIngredients((current) => current.filter((_, i) => i !== index))}
                  aria-label={`Retirer « ${item.label} »`}
                  className="rounded-md p-1 text-subtle hover:bg-surface-sunken hover:text-danger-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {picking ? (
          <div className="mt-3 space-y-3 rounded-xl border border-line p-3">
            <FoodSearch onSelect={(food) => setPicked(food)} personalFoods={personalFoods} />
            {picked && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{foodLabel(picked)}</div>
                  <div className="text-xs text-subtle">{formatNumber(Math.round(picked.kcal_per_100g))} kcal pour 100 g</div>
                </div>
                <div className="w-28">
                  <Field
                    label="Quantité (g)"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={RECIPE_LIMITS.qtyMax}
                    value={pickedQty}
                    onChange={(e) => setPickedQty(e.target.value)}
                  />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => { setPicking(false); setPicked(null); }}>
                Annuler
              </Button>
              <Button size="sm" onClick={addPicked} disabled={!canAddPicked}>
                Ajouter à la recette
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPicking(true)}
            disabled={ingredients.length >= RECIPE_LIMITS.ingredientsMax}
            className="mt-2 w-full rounded-xl border border-dashed border-line-strong px-4 py-2 text-sm font-medium text-primary-700 hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 disabled:opacity-50"
          >
            + Ajouter un ingrédient
          </button>
        )}
      </section>

      {ingredients.length > 0 && (
        <div className="rounded-xl bg-surface-muted p-3 text-sm" aria-live="polite">
          <div className="flex justify-between gap-2">
            <span className="text-muted">Total ({formatNumber(totals.weight_g)} g cru)</span>
            <span className="font-semibold text-ink">{formatNumber(totals.kcal)} kcal</span>
          </div>
          <div className="text-xs text-subtle">{macroLine(totals)}</div>
          {perServing && (
            <>
              <div className="mt-2 flex justify-between gap-2">
                <span className="text-muted">
                  Par part ({formatNumber(perServing.qty_grammes)} g {cooked ? 'cuit' : 'cru'})
                </span>
                <span className="font-bold text-brand-800">{formatNumber(perServing.kcal)} kcal</span>
              </div>
              <div className="text-xs text-subtle">{macroLine(perServing)}</div>
            </>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-md border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Annuler
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>

      {initial && onDelete && (
        <div className="border-t border-line-subtle pt-3">
          {confirmDelete ? (
            <div role="alertdialog" aria-label="Confirmer la suppression" className="space-y-2 text-sm">
              <p className="text-body">
                Supprimer « {initial.name} » ? Les repas déjà notés ne changent pas.
              </p>
              <div className="flex gap-2">
                <Button variant="danger" size="sm" onClick={handleDelete} disabled={saving}>
                  Supprimer
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)} disabled={saving}>
                  Garder la recette
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="text-danger-700" onClick={() => setConfirmDelete(true)}>
              Supprimer la recette
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
