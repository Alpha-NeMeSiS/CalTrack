// Objectif d'eau : automatique d'après le poids (30 ml/kg) ou personnalisé.
import { useState } from 'react';
import { Droplet } from 'lucide-react';
import { formatDecimal } from '../../utils/format';
import { autoWaterGoal, formatLiters, parseLiters, WATER_LIMITS } from '../../utils/water';

interface WaterGoalSectionProps {
  /** Objectif manuel (ml), null = automatique */
  goalMl: number | null;
  weightKg?: number | null;
  onChange: (goalMl: number | null) => void;
}

export function WaterGoalSection({ goalMl, weightKg, onChange }: WaterGoalSectionProps) {
  const auto = autoWaterGoal(weightKg);
  const [custom, setCustom] = useState(formatDecimal((goalMl ?? auto) / 1000, 2));
  const isCustom = goalMl !== null;
  const autoDetail = weightKg
    ? `${WATER_LIMITS.mlPerKg} ml par kg × ${formatDecimal(weightKg)} kg, suit vos pesées`
    : 'Poids inconnu : 2 L par défaut';

  const option = (selected: boolean) =>
    `flex cursor-pointer items-start gap-3 rounded-md border-2 p-3 transition-colors ${
      selected ? 'border-primary-600 bg-primary-50' : 'border-line hover:border-line-strong'
    }`;

  return (
    <section aria-labelledby="water-goal-title" className="space-y-4 panel p-4 sm:p-6">
      <div>
        <h2 id="water-goal-title" className="flex items-center gap-2 card-title">
          <Droplet className="h-5 w-5 text-subtle" aria-hidden="true" />
          Eau
        </h2>
        <p className="mt-1 text-sm text-muted">Objectif quotidien de la carte « Eau » du journal.</p>
      </div>
      <fieldset className="space-y-2">
        <legend className="sr-only">Objectif d’eau</legend>
        <label className={option(!isCustom)}>
          <input type="radio" name="water-goal" checked={!isCustom} onChange={() => onChange(null)} className="mt-1" />
          <span>
            <span className="block text-sm font-medium text-ink">Automatique : {formatLiters(auto)}</span>
            <span className="block text-xs text-subtle">{autoDetail}</span>
          </span>
        </label>
        <label className={option(isCustom)}>
          <input
            type="radio"
            name="water-goal"
            checked={isCustom}
            onChange={() => onChange(parseLiters(custom))}
            className="mt-1"
          />
          <span className="flex-1">
            <span className="block text-sm font-medium text-ink">Personnalisé</span>
            <span className="block text-xs text-subtle">De 0,5 à 6 L</span>
          </span>
        </label>
        {isCustom && (
          <div className="pl-1">
            <label htmlFor="water-goal-liters" className="field-label mb-1">
              Objectif (L)
            </label>
            <input
              id="water-goal-liters"
              type="text"
              inputMode="decimal"
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
                onChange(parseLiters(e.target.value));
              }}
              className="field-input w-28 px-3 py-2"
            />
          </div>
        )}
      </fieldset>
    </section>
  );
}
