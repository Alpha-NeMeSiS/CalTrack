// Proposition d'ajustement des calories (page Tendances) : la dépense réelle,
// estimée d'après les repas saisis et l'évolution du poids, s'écarte de la
// cible calculée. L'utilisateur applique l'ajustement ou l'écarte pour une
// semaine (mémorisé sur cet appareil). Voir src/utils/calorieAdjustment.ts.
import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { Goal } from '../../lib/supabase';
import { applyCalorieAdjustment } from '../../services/goals';
import type { UserProfile } from '../../utils/calculations';
import { ADJUSTMENT_COOLDOWN_DAYS, CalorieAdjustmentSuggestion, dismissKey } from '../../utils/calorieAdjustment';
import { addDaysToDateString } from '../../utils/date';
import { formatNumber, formatSigned } from '../../utils/format';
import { EXPENDITURE_WINDOW_DAYS } from '../../utils/insights';

interface CalorieAdjustmentCardProps {
  userId: string;
  profile: UserProfile;
  goal: Goal;
  suggestion: CalorieAdjustmentSuggestion;
  today: string;
  onApplied: (goal: Goal) => void;
}


function readDismissed(goalId: string): string | null {
  try {
    return localStorage.getItem(dismissKey(goalId));
  } catch {
    return null;
  }
}

/** Phrase d'explication selon le type d'objectif et le sens de l'ajustement */
function explanation(goal: Goal, suggestion: CalorieAdjustmentSuggestion) {
  const pace = `(${formatSigned(suggestion.weeklyChangeKg, 1)} kg/semaine)`;
  const real = `votre dépense réelle (≈ ${formatNumber(suggestion.expenditureKcal)} kcal/j) est plus ${
    suggestion.direction === 'more' ? 'élevée' : 'basse'
  } que celle calculée`;
  if (goal.type === 'loss') {
    return suggestion.direction === 'more'
      ? `Vous perdez plus vite que prévu ${pace} : ${real}. Vous pouvez manger un peu plus en gardant un rythme sain.`
      : `Votre perte est plus lente que prévu ${pace} : ${real}. Réduire un peu vos calories vous remettra sur le rythme visé.`;
  }
  if (goal.type === 'gain') {
    return suggestion.direction === 'more'
      ? `Votre prise de poids est plus lente que prévu ${pace} : ${real}. Mangez un peu plus pour atteindre le rythme visé.`
      : `Vous prenez du poids plus vite que prévu ${pace} : ${real}. Réduire un peu limitera la prise de gras.`;
  }
  return suggestion.direction === 'more'
    ? `Votre poids baisse ${pace} alors que vous visez le maintien : ${real}.`
    : `Votre poids monte ${pace} alors que vous visez le maintien : ${real}.`;
}

export function CalorieAdjustmentCard({ userId, profile, goal, suggestion, today, onApplied }: CalorieAdjustmentCardProps) {
  const [hidden, setHidden] = useState(() => {
    const dismissedOn = readDismissed(goal.id);
    return Boolean(dismissedOn && dismissedOn > addDaysToDateString(today, -ADJUSTMENT_COOLDOWN_DAYS));
  });
  const [applying, setApplying] = useState(false);
  const [appliedKcal, setAppliedKcal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (hidden) return null;

  const handleApply = async () => {
    setApplying(true);
    setError(null);
    try {
      const updated = await applyCalorieAdjustment({ userId, goal, adjustmentKcal: suggestion.newAdjustmentKcal, profile, today });
      setAppliedKcal(suggestion.proposedTargetKcal);
      onApplied(updated);
    } catch (applyError) {
      console.error('Error applying calorie adjustment:', applyError);
      setError('L’ajustement n’a pas pu être appliqué. Vérifiez votre connexion puis réessayez.');
    } finally {
      setApplying(false);
    }
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(dismissKey(goal.id), today);
    } catch {
      // Stockage indisponible (navigation privée) : masqué jusqu'au prochain chargement
    }
    setHidden(true);
  };

  if (appliedKcal !== null) {
    return (
      <p role="status" className="rounded-lg border border-success-200 bg-success-50 p-4 text-sm text-success-800">
        Objectif ajusté : {formatNumber(appliedKcal)} kcal/j dès aujourd’hui. Vous pouvez annuler cet ajustement dans
        l’onglet Objectif.
      </p>
    );
  }

  return (
    <section aria-labelledby="calorie-adjustment-title" className="space-y-3 rounded-lg border border-info-200 bg-info-50 p-4">
      <h3 id="calorie-adjustment-title" className="flex items-center gap-2 text-sm font-semibold text-info-900">
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        Ajuster vos calories ?
      </h3>
      <p className="text-sm text-info-900">{explanation(goal, suggestion)}</p>
      <p className="text-base font-semibold text-info-900">
        {formatNumber(suggestion.currentTargetKcal)} kcal/j → {formatNumber(suggestion.proposedTargetKcal)} kcal/j (
        {formatSigned(suggestion.deltaKcal)} kcal)
      </p>
      <p className="text-xs text-info-800">
        Calculé sur vos {EXPENDITURE_WINDOW_DAYS} derniers jours (repas saisis et pesées). Fiable si vos journées sont
        saisies en entier. Les protéines et les lipides ne changent pas : seuls les glucides suivent.
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={handleApply} disabled={applying} className="btn-brand disabled:opacity-50">
          {applying ? 'Application…' : 'Appliquer'}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={applying}
          className="rounded-md border border-info-300 px-4 py-2 text-sm font-medium text-info-800 hover:bg-info-100"
        >
          Pas maintenant
        </button>
      </div>
    </section>
  );
}
