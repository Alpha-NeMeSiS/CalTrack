// Carte « Estimation pour 100 g » : produit scanné sans valeurs, estimation
// d'après les produits les plus proches et liste de produits proches au choix.
import { useId, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { NormalizedFood, NutritionPer100 } from '../../types/food';
import {
  estimateOrigin,
  estimateSource,
  estimateSummary,
  nutritionOf,
  productOrigin,
  SimilarEstimate,
} from '../../lib/similarProducts';
import { formatDecimal } from '../../utils/format';

interface SimilarEstimateCardProps {
  estimate: SimilarEstimate;
  /** Valeurs choisies (estimation ou produit proche) et leur source pour le bandeau */
  onUse: (values: NutritionPer100, source: string) => void;
  /** Saisie des valeurs de l'étiquette (formulaire vide) */
  onManual: () => void;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Valeurs d'un produit proche, arrondies comme une estimation */
function roundedValues(food: NormalizedFood): NutritionPer100 {
  const values = nutritionOf(food);
  return {
    kcal_per_100g: Math.round(values.kcal_per_100g),
    protein_g: round1(values.protein_g),
    fat_g: round1(values.fat_g),
    carbs_g: round1(values.carbs_g),
    fiber_g: round1(values.fiber_g),
  };
}

const firstBrand = (food: NormalizedFood) => food.brand?.split(',')[0]?.trim();

export function SimilarEstimateCard({ estimate, onUse, onManual }: SimilarEstimateCardProps) {
  const titleId = useId();
  const listId = useId();
  const [listOpen, setListOpen] = useState(false);
  const { values } = estimate;
  const sameBrand = estimate.proximity === 'same-brand';

  return (
    <section aria-labelledby={titleId} className="panel space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id={titleId} className="section-label">
            Estimation pour 100 g
          </h3>
          <p className="mt-1 text-xs text-subtle">{estimateSummary(estimate)}</p>
        </div>
        <span className={`badge shrink-0 ${sameBrand ? 'badge-success' : 'badge-info'}`}>
          {sameBrand ? 'Même marque' : 'Autres marques'}
        </span>
      </div>

      <p className="flex items-baseline gap-2 text-sm text-muted">
        <span className="text-2xl font-semibold text-ink">≈ {values.kcal_per_100g}</span> kcal
      </p>
      <p className="text-sm text-body">
        Protéines {formatDecimal(values.protein_g)} g · Lipides {formatDecimal(values.fat_g)} g · Glucides{' '}
        {formatDecimal(values.carbs_g)} g
      </p>
      <p className="text-xs text-subtle">{estimateOrigin(estimate)}. À vérifier avec l’étiquette si vous l’avez.</p>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => onUse(values, estimateSource(estimate))}
          className="btn-primary rounded-md px-3 py-1.5 text-sm font-medium"
        >
          Utiliser l’estimation
        </button>
        <button type="button" onClick={onManual} className="btn-secondary rounded-md px-3 py-1.5 text-sm font-medium">
          Saisir l’étiquette
        </button>
      </div>

      <div className="border-t border-line pt-3">
        <button
          type="button"
          aria-expanded={listOpen}
          aria-controls={listId}
          onClick={() => setListOpen((open) => !open)}
          className="flex w-full items-center justify-between rounded-md text-sm font-medium text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
        >
          Ou choisir un produit proche ({estimate.choices.length})
          {listOpen ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
        </button>
        {listOpen && (
          <ul id={listId} className="mt-2 divide-y divide-line">
            {estimate.choices.map(({ food }) => {
              const rounded = roundedValues(food);
              const brand = firstBrand(food);
              return (
                <li key={food.offCode ?? food.name} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-body">{food.name}</div>
                    <div className="text-xs text-subtle">
                      {brand ? `${brand} · ` : ''}
                      {rounded.kcal_per_100g} kcal · P {formatDecimal(rounded.protein_g)} · L {formatDecimal(rounded.fat_g)} · G{' '}
                      {formatDecimal(rounded.carbs_g)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUse(rounded, `1 produit proche : ${productOrigin(food)}`)}
                    aria-label={`Utiliser les valeurs de « ${food.name} »`}
                    className="btn-secondary shrink-0 rounded-md px-3 py-1 text-xs font-medium"
                  >
                    Utiliser
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
