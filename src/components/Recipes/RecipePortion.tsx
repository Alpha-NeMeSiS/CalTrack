// Ajout d'une recette au journal : en parts (par demi-part) ou en grammes
// (si le poids cuit est connu), choix du repas et aperçu de la ligne notée.
import { useState } from 'react';
import { ChevronLeft, Minus, Plus } from 'lucide-react';
import type { Recipe } from '../../lib/supabase';
import type { AddEntryPayload, MealType } from '../../utils/entries';
import { formatDecimal, formatNumber } from '../../utils/format';
import { PortionChoice, RECIPE_LIMITS, recipePortion, recipeToDraft } from '../../utils/recipes';
import { MealTypeSelector } from '../Journal/MealTypeSelector';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';

interface RecipePortionProps {
  recipe: Recipe;
  defaultMeal?: MealType;
  disabled?: boolean;
  onAdd: (entry: AddEntryPayload) => Promise<boolean>;
  onBack: () => void;
}

export function RecipePortion({ recipe, defaultMeal, disabled, onAdd, onBack }: RecipePortionProps) {
  const draft = recipeToDraft(recipe);
  const cooked = draft.cooked_weight_g;
  const [mode, setMode] = useState<'servings' | 'grams'>('servings');
  const [servings, setServings] = useState(1);
  const [grams, setGrams] = useState(cooked ? String(Math.round(cooked / draft.servings)) : '');
  const [meal, setMeal] = useState<MealType | undefined>(defaultMeal);

  // Sans poids cuit, seule la saisie en parts est possible
  const effectiveMode = cooked ? mode : 'servings';
  const gramsValue = Number(grams.replace(',', '.'));
  const gramsValid = Number.isFinite(gramsValue) && gramsValue > 0 && gramsValue <= RECIPE_LIMITS.qtyMax;
  const choice: PortionChoice | null =
    effectiveMode === 'grams' ? (gramsValid ? { mode: 'grams', grams: gramsValue } : null) : { mode: 'servings', servings };
  const portion = choice ? recipePortion(draft, choice) : null;

  const step = RECIPE_LIMITS.portionStep;
  const servingsLabel = `${formatDecimal(servings)} ${servings < 2 ? 'part' : 'parts'}`;

  const submit = async () => {
    if (!portion) return;
    await onAdd({
      label: portion.label,
      qty_grammes: portion.qty_grammes,
      kcal: portion.kcal,
      protein_g: portion.protein_g,
      fat_g: portion.fat_g,
      carbs_g: portion.carbs_g,
      fiber_g: portion.fiber_g,
      meal_type: meal,
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 text-primary-700" aria-label="Retour aux recettes">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Recettes
        </Button>
        <h3 className="card-title mt-1">{recipe.name}</h3>
        <p className="text-sm text-subtle">
          {recipe.servings} {recipe.servings > 1 ? 'parts' : 'part'}
          {cooked ? ` · poids cuit ${formatNumber(cooked)} g` : ''}
        </p>
      </div>

      {cooked && (
        <div role="group" aria-label="Quantité" className="grid grid-cols-2 gap-1 rounded-lg bg-surface-sunken p-1 text-sm font-medium">
          {(['servings', 'grams'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={effectiveMode === value}
              onClick={() => setMode(value)}
              className={`rounded-md px-3 py-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 ${
                effectiveMode === value ? 'bg-surface text-primary-700 shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              {value === 'servings' ? 'En parts' : 'En grammes'}
            </button>
          ))}
        </div>
      )}

      {effectiveMode === 'servings' ? (
        <div className="flex items-center justify-center gap-4" role="group" aria-label="Nombre de parts">
          <Button
            variant="secondary"
            className="h-11 w-11 rounded-full"
            onClick={() => setServings((n) => Math.max(RECIPE_LIMITS.portionMin, n - step))}
            disabled={servings <= RECIPE_LIMITS.portionMin}
            aria-label="Retirer une demi-part"
          >
            <Minus className="h-5 w-5" aria-hidden="true" />
          </Button>
          <div className="min-w-24 text-center" aria-live="polite">
            <div className="text-3xl font-bold text-ink">{formatDecimal(servings)}</div>
            <div className="text-xs text-subtle">{servings < 2 ? 'part' : 'parts'}</div>
            <span className="sr-only">{servingsLabel}</span>
          </div>
          <Button
            variant="secondary"
            className="h-11 w-11 rounded-full"
            onClick={() => setServings((n) => Math.min(RECIPE_LIMITS.portionMax, n + step))}
            disabled={servings >= RECIPE_LIMITS.portionMax}
            aria-label="Ajouter une demi-part"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <Field
          label="Quantité (g)"
          type="number"
          inputMode="numeric"
          min={1}
          max={RECIPE_LIMITS.qtyMax}
          value={grams}
          onChange={(e) => setGrams(e.target.value)}
          error={gramsValid ? undefined : 'Indiquez une quantité entre 1 et 5 000 g.'}
        />
      )}

      <MealTypeSelector value={meal} onChange={setMeal} />

      {portion && (
        <div className="rounded-xl bg-surface-muted p-3" aria-live="polite">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm text-muted">Valeurs</span>
            <span className="text-2xl font-bold text-ink">{formatNumber(portion.kcal)} kcal</span>
          </div>
          <div className="text-xs text-subtle">
            P {formatNumber(portion.protein_g)} g · L {formatNumber(portion.fat_g)} g · G {formatNumber(portion.carbs_g)} g · F{' '}
            {formatNumber(portion.fiber_g)} g
          </div>
          <div className="mt-2 text-xs text-muted">
            Au journal : <span className="font-semibold text-body">{portion.label}</span> · {formatNumber(portion.qty_grammes)} g
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={onBack} disabled={disabled}>
          Retour
        </Button>
        <Button onClick={submit} disabled={disabled || !portion}>
          Ajouter
        </Button>
      </div>
    </div>
  );
}
