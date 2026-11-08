// Aperçu de l'objectif quotidien AVANT validation (onboarding et paramètres).
// Affiche calories et macros calculées, et les garde-fous appliqués :
// plancher calorique, rythme trop rapide (avec durée réaliste proposée).
import { AlertTriangle, Flame } from 'lucide-react';
import { calculateCompleteTargets, UserProfile } from '../../utils/calculations';
import { chooseBmrMethod, DEFAULT_FAT_G_PER_KG_MIN, DEFAULT_PROTEIN_G_PER_KG } from '../../utils/goals';
import { GoalFormInput, getGoalWarnings, validateGoalInput, validateProfileInput } from '../../utils/validation';

interface GoalTargetsPreviewProps {
  profile: UserProfile;
  goal: GoalFormInput;
  /** Appelé quand l'utilisateur accepte la durée réaliste proposée */
  onApplyDuration?: (weeks: number) => void;
}

const formatG = (value: number) => `${Math.round(value)} g`;

export function GoalTargetsPreview({ profile, goal, onApplyDuration }: GoalTargetsPreviewProps) {
  // Pas d'aperçu tant que les saisies ne sont pas valides (évite d'afficher NaN)
  if (validateProfileInput(profile).length > 0 || validateGoalInput(goal, profile.poids_kg).length > 0) {
    return null;
  }

  const targets = calculateCompleteTargets(profile, {
    type: goal.type,
    activity_level: goal.activity_level,
    method: chooseBmrMethod(profile),
    deficit_or_surplus_pct: goal.type === 'maintain' ? 0 : goal.deficit_or_surplus_pct,
    protein_g_per_kg: goal.protein_g_per_kg || DEFAULT_PROTEIN_G_PER_KG,
    fat_g_per_kg_min: DEFAULT_FAT_G_PER_KG_MIN,
  });
  const warnings = getGoalWarnings(goal, profile.poids_kg);

  return (
    <section aria-label="Aperçu de votre objectif quotidien" className="space-y-3">
      <div className="rounded-md border border-kaizen-200 bg-kaizen-50 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-kaizen-700">
          <Flame className="h-4 w-4" aria-hidden="true" />
          Votre objectif quotidien
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-2xl font-bold text-gray-900" data-testid="preview-calories">
            {targets.calories_kcal} kcal
          </span>
          <span className="text-sm text-gray-600">
            Protéines {formatG(targets.protein_g)} · Lipides {formatG(targets.fat_g)} · Glucides{' '}
            {formatG(targets.carbs_g)} · Fibres {formatG(targets.fiber_g ?? 0)}
          </span>
        </div>
      </div>

      {targets.calorie_floor_applied && (
        <div role="status" className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <p>
            Calories relevées à {targets.calories_kcal} kcal : un déficit plus important descendrait sous votre
            métabolisme de base ou sous le minimum recommandé. La perte sera un peu plus lente que prévu.
          </p>
        </div>
      )}

      {warnings.map((warning) => (
        <div key={warning.message} role="status" className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <div className="space-y-2">
            <p>{warning.message}</p>
            {warning.suggestedDurationWeeks && onApplyDuration && (
              <button
                type="button"
                onClick={() => onApplyDuration(warning.suggestedDurationWeeks!)}
                className="rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
              >
                Utiliser {warning.suggestedDurationWeeks} semaines
              </button>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
