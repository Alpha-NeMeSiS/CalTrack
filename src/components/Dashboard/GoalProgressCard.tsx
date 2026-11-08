// Carte de progression pour un objectif
// Affiche l'état d'avancement temporel et de poids pour l'objectif actif.
// L'évolution réelle du poids n'est affichée que si le poids de départ est connu
// (goals.start_weight_kg, enregistré à la création de l'objectif).
import { Target, Calendar, TrendingUp } from 'lucide-react';
import { Goal } from '../../lib/supabase';
import { calculateGoalProgress } from '../../utils/calculations';
import { useEffect, useState } from 'react';
import { computeTimeProgress, humanizeRemainingDays, addWeeks, formatDateFR } from '../../lib/timeProgress';
import { parseLocalDate } from '../../utils/date';
import { formatDecimal, formatNumber, formatPercent, formatSigned } from '../../utils/format';
import { Badge, type BadgeTone } from '../ui/Badge';

interface GoalProgressCardProps {
  goal: Goal;
  currentWeight: number;
}

export function GoalProgressCard({ goal, currentWeight }: GoalProgressCardProps) {
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // La carte n'a de sens que pour un objectif de poids avec une durée
  if (!goal.target_weight_kg || !goal.start_date || !goal.duration_weeks || goal.type === 'maintain') {
    return null;
  }

  const hasStartWeight = goal.start_weight_kg != null && goal.start_weight_kg > 0;

  const progress = calculateGoalProgress(
    currentWeight,
    goal.target_weight_kg,
    goal.duration_weeks,
    goal.start_date,
    goal.type,
    hasStartWeight ? Number(goal.start_weight_kg) : undefined,
    now
  );

  const weightStatus: { label: string; tone: BadgeTone } = progress.goal_reached
    ? { label: 'Objectif atteint', tone: 'success' }
    : progress.on_track
      ? { label: 'Dans les temps', tone: 'info' }
      : { label: 'En retard sur le rythme prévu', tone: 'warning' };

  // parseLocalDate : évite le décalage UTC de new Date('YYYY-MM-DD')
  const start = parseLocalDate(goal.start_date);
  const end = goal.end_date ? parseLocalDate(goal.end_date) : addWeeks(start, goal.duration_weeks);

  const time = computeTimeProgress(start, end, now);
  const progressBarWidth = Math.min(Math.max(time.percent, 0), 100);

  return (
    <div className="bg-gradient-to-br from-info-50 to-info-100 rounded-lg p-4 sm:p-6 border border-info-200">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-5 h-5 text-brand-700" aria-hidden="true" />
        <h3 className="card-title">Progression de l'objectif</h3>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
        <div className="bg-surface rounded-md p-2 sm:p-3">
          <div className="text-xs text-muted mb-1">Poids actuel</div>
          <div className="text-lg sm:text-2xl font-bold text-ink">{currentWeight} kg</div>
        </div>

        <div className="bg-surface rounded-md p-2 sm:p-3">
          <div className="text-xs text-muted mb-1">Objectif</div>
          <div className="text-lg sm:text-2xl font-bold text-info-600">{formatDecimal(Number(goal.target_weight_kg))} kg</div>
        </div>

        <div className="bg-surface rounded-md p-2 sm:p-3">
          <div className="text-xs text-muted mb-1">Reste à atteindre</div>
          <div className="text-lg sm:text-2xl font-bold text-ink">
            {formatSigned(progress.goal_reached ? 0 : progress.weight_change, 1)} kg
          </div>
        </div>
      </div>

      {hasStartWeight && (
        <div className="mb-4" data-testid="weight-progress">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
            <span className="text-sm font-medium text-body">Progression du poids</span>
            <Badge tone={weightStatus.tone} className="rounded-full">
              {weightStatus.label}
            </Badge>
          </div>
          <div className="flex justify-between text-xs text-muted mb-1">
            <span>Départ : {formatDecimal(progress.start_weight)} kg</span>
            <span>
              Évolution : {formatSigned(progress.actual_weight_change, 1)} kg · {formatPercent(progress.weight_progress_pct)}
            </span>
          </div>
          <div
            className="relative w-full h-3 bg-surface rounded-full overflow-hidden"
            role="progressbar"
            aria-label="Progression vers le poids cible"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.weight_progress_pct)}
          >
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-success-400 to-success-600 transition-all duration-500"
              style={{ width: `${progress.weight_progress_pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-body">Progression temporelle</span>
          <span className="text-sm text-info-600">{formatPercent(time.percent, 1)}</span>
        </div>
        <div className="relative w-full h-3 bg-surface rounded-full overflow-hidden" role="progressbar" aria-label="Progression temporelle" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(time.percent)}>
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-info-500 to-info-600 transition-all duration-500"
            style={{ width: `${progressBarWidth}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2 bg-surface rounded-md p-2">
          <Calendar className="w-4 h-4 text-subtle" />
          <div>
            <div className="text-xs text-subtle">Temps écoulé</div>
            <div className="font-semibold text-ink">
              {Math.floor(time.elapsedWeeks)} semaine{time.elapsedWeeks > 1 ? 's' : ''} 
              {time.elapsedDays % 7 > 0 ? ` et ${time.elapsedDays % 7} jour${time.elapsedDays % 7 > 1 ? 's' : ''}` : ''} 
              <span className="text-xs text-subtle ml-1">/ {Math.ceil(time.totalWeeks)} sem.</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-surface rounded-md p-2">
          <TrendingUp className="w-4 h-4 text-subtle" />
          <div>
            <div className="text-xs text-subtle">Rythme cible</div>
            <div className="font-semibold text-ink">
              {formatNumber(Math.abs(progress.weekly_rate_target), 2)} kg/sem
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-info-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Date de fin prévue :</span>
          <span className="font-semibold text-ink">{formatDateFR(end)}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-muted">Temps restant :</span>
          <span className="font-semibold text-info-600">
            {time.percent >= 100 ? 'Terminé' : humanizeRemainingDays(now, end, start)}
          </span>
        </div>
      </div>
    </div>
  );
}
