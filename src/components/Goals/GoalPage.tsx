// Onglet « Objectif » : objectif en cours (résumé et progression), formulaire
// pour le modifier ou en définir un nouveau, et historique des objectifs passés.
import { useCallback, useEffect, useState } from 'react';
import { History, Target } from 'lucide-react';
import type { Goal } from '../../lib/supabase';
import { useAuth } from '../../contexts/useAuth';
import { applyCalorieAdjustment, fetchUserGoals } from '../../services/goals';
import { getActivityLevelLabel, getGoalTypeLabel } from '../../utils/calculations';
import { getTodayDate, parseLocalDate } from '../../utils/date';
import { buildGoalHistory, getGoalStartDate, isGoalEndedOn } from '../../utils/goals';
import { GoalProgressCard } from '../Dashboard/GoalProgressCard';
import { GoalForm } from './GoalForm';

const formatDate = (date: string | null | undefined) =>
  date ? parseLocalDate(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

const formatKg = (value: number | null | undefined) =>
  value ? `${Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kg` : null;

function GoalSummary({ goal }: { goal: Goal }) {
  const today = getTodayDate();
  const ended = isGoalEndedOn(goal, today);
  const details = [
    { label: 'Début', value: formatDate(getGoalStartDate(goal)) },
    { label: 'Fin', value: goal.end_date ? formatDate(goal.end_date) : 'Sans limite' },
    { label: 'Activité', value: getActivityLevelLabel(Number(goal.activity_level)) },
    goal.type !== 'maintain'
      ? { label: goal.type === 'loss' ? 'Déficit' : 'Surplus', value: `${Number(goal.deficit_or_surplus_pct)} %` }
      : null,
    formatKg(goal.target_weight_kg) && goal.type !== 'maintain'
      ? { label: 'Poids cible', value: formatKg(goal.target_weight_kg) as string }
      : null,
    { label: 'Protéines', value: `${Number(goal.protein_g_per_kg).toLocaleString('fr-FR')} g/kg` },
  ].filter((item): item is { label: string; value: string } => item !== null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg font-semibold text-ink">{getGoalTypeLabel(goal.type)}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            ended ? 'bg-warning-100 text-warning-800' : 'bg-brand-100 text-brand-700'
          }`}
        >
          {ended ? 'Terminé — suivi en maintien' : 'En cours'}
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {details.map((item) => (
          <div key={item.label} className="flex justify-between gap-4 border-b border-line-subtle pb-1">
            <dt className="text-subtle">{item.label}</dt>
            <dd className="text-right font-medium text-ink">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Ajustement des calories accepté depuis Tendances, annulable */
function CalorieAdjustmentInfo({ goal, onCancel }: { goal: Goal; onCancel: () => Promise<void> }) {
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const adjustment = Number(goal.calorie_adjustment_kcal);
  const since = goal.calorie_adjustment_at
    ? new Date(goal.calorie_adjustment_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
    : null;

  const handleCancel = async () => {
    setCancelling(true);
    setError(null);
    try {
      await onCancel();
    } catch (cancelError) {
      console.error('Error cancelling calorie adjustment:', cancelError);
      setError("L'ajustement n'a pas pu être annulé. Réessayez.");
      setCancelling(false);
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-2 rounded-md border border-info-200 bg-info-50 p-3 text-sm text-info-900 sm:flex-row sm:items-center sm:justify-between">
      <p>
        <span className="font-semibold">
          {adjustment > 0 ? '+' : '−'}
          {Math.abs(adjustment).toLocaleString('fr-FR')} kcal/j d’après votre dépense réelle
        </span>
        {since ? ` (depuis le ${since})` : ''}. Les jours passés gardent leur cible.
      </p>
      <button
        type="button"
        onClick={handleCancel}
        disabled={cancelling}
        className="shrink-0 rounded-md border border-info-300 px-3 py-1.5 font-medium text-info-800 hover:bg-info-100 disabled:opacity-50"
      >
        {cancelling ? 'Annulation…' : 'Annuler l’ajustement'}
      </button>
      {error && (
        <p role="alert" className="text-danger-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function GoalPage() {
  const { user, profile } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adjustmentCancelled, setAdjustmentCancelled] = useState(false);

  const loadGoals = useCallback(async () => {
    if (!user) return;
    setLoadError(null);
    try {
      setGoals(await fetchUserGoals(user.id));
    } catch (error) {
      console.error('Error loading goals:', error);
      setLoadError('Impossible de charger vos objectifs.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const activeGoal = goals.find((goal) => goal.is_active) ?? null;
  const history = buildGoalHistory(goals);

  if (loading) {
    return <div className="py-12 text-center text-subtle">Chargement…</div>;
  }

  if (loadError) {
    return (
      <div role="alert" className="mx-auto max-w-4xl panel p-6 text-center">
        <p className="mb-4 text-danger-700">{loadError}</p>
        <button type="button" onClick={() => loadGoals()} className="btn-brand">
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="page-title">Objectif</h1>

      {activeGoal && (
        <section aria-labelledby="current-goal-title" className="panel p-4 sm:p-6">
          <h2 id="current-goal-title" className="mb-4 flex items-center gap-2 card-title">
            <Target className="h-5 w-5 text-brand-600" aria-hidden="true" />
            Objectif actuel
          </h2>
          <GoalSummary goal={activeGoal} />
          {(Number(activeGoal.calorie_adjustment_kcal) || 0) !== 0 && profile && user && (
            <CalorieAdjustmentInfo
              goal={activeGoal}
              onCancel={async () => {
                await applyCalorieAdjustment({ userId: user.id, goal: activeGoal, adjustmentKcal: 0, profile, today: getTodayDate() });
                setAdjustmentCancelled(true);
                await loadGoals();
              }}
            />
          )}
          {adjustmentCancelled && (
            <p role="status" className="mt-3 text-sm text-brand-700">
              Ajustement annulé : vos calories suivent de nouveau le calcul de la formule.
            </p>
          )}
        </section>
      )}

      {activeGoal && profile && activeGoal.target_weight_kg && activeGoal.type !== 'maintain' && (
        <GoalProgressCard goal={activeGoal} currentWeight={profile.poids_kg} />
      )}

      <section aria-labelledby="goal-form-title" className="panel p-4 sm:p-6">
        <h2 id="goal-form-title" className="mb-1 card-title">
          {activeGoal ? "Modifier l'objectif" : 'Définir un objectif'}
        </h2>
        <p className="mb-6 text-sm text-muted">
          {activeGoal
            ? 'Le nouvel objectif démarre aujourd’hui ; l’objectif actuel passe dans l’historique.'
            : 'Choisissez votre objectif pour obtenir vos calories et macros quotidiennes.'}
        </p>
        <GoalForm key={activeGoal?.id ?? 'none'} activeGoal={activeGoal} onSaved={loadGoals} />
      </section>

      {history.length > 0 && (
        <section aria-labelledby="goal-history-title" className="panel p-4 sm:p-6">
          <h2 id="goal-history-title" className="mb-4 flex items-center gap-2 card-title">
            <History className="h-5 w-5 text-subtle" aria-hidden="true" />
            Historique
          </h2>
          <ul className="divide-y divide-line-subtle">
            {history.map(({ goal, start, end, replaced }) => {
              const weights = [formatKg(goal.start_weight_kg), goal.type !== 'maintain' ? formatKg(goal.target_weight_kg) : null];
              return (
                <li key={goal.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-ink">{getGoalTypeLabel(goal.type)}</p>
                    <p className="text-sm text-muted">
                      Du {formatDate(start)} au {end ? formatDate(end) : '—'}
                      {replaced ? ' (remplacé)' : ''}
                    </p>
                  </div>
                  {(weights[0] || weights[1]) && (
                    <p className="text-sm text-muted">
                      {weights[0] ?? '?'}
                      {weights[1] ? ` → ${weights[1]}` : ''}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
