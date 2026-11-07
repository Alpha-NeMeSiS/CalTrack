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

  const formatKg = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)} kg`;
  const weightStatus = progress.goal_reached
    ? { label: 'Objectif atteint', className: 'bg-green-100 text-green-700' }
    : progress.on_track
      ? { label: 'Dans les temps', className: 'bg-blue-100 text-blue-700' }
      : { label: 'En retard sur le rythme prévu', className: 'bg-orange-100 text-orange-700' };

  // parseLocalDate : évite le décalage UTC de new Date('YYYY-MM-DD')
  const start = parseLocalDate(goal.start_date);
  const end = goal.end_date ? parseLocalDate(goal.end_date) : addWeeks(start, goal.duration_weeks);

  const time = computeTimeProgress(start, end, now);
  const progressBarWidth = Math.min(Math.max(time.percent, 0), 100);

  return (
    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg text-blue-600">Progression de l'objectif</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded-md p-3">
          <div className="text-xs text-gray-600 mb-1">Poids actuel</div>
          <div className="text-2xl font-bold text-gray-900">{currentWeight} kg</div>
        </div>

        <div className="bg-white rounded-md p-3">
          <div className="text-xs text-gray-600 mb-1">Objectif</div>
          <div className="text-2xl font-bold text-blue-600">{goal.target_weight_kg} kg</div>
        </div>

        <div className="bg-white rounded-md p-3">
          <div className="text-xs text-gray-600 mb-1">Reste à atteindre</div>
          <div className="text-2xl font-bold text-gray-900">
            {progress.goal_reached ? '0.0 kg' : formatKg(progress.weight_change)}
          </div>
        </div>
      </div>

      {hasStartWeight && (
        <div className="mb-4" data-testid="weight-progress">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-700">Progression du poids</span>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${weightStatus.className}`}>
              {weightStatus.label}
            </span>
          </div>
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Départ : {progress.start_weight} kg</span>
            <span>
              Évolution : {formatKg(progress.actual_weight_change)} · {progress.weight_progress_pct.toFixed(0)} %
            </span>
          </div>
          <div
            className="relative w-full h-3 bg-white rounded-full overflow-hidden"
            role="progressbar"
            aria-label="Progression vers le poids cible"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.weight_progress_pct)}
          >
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
              style={{ width: `${progress.weight_progress_pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Progression temporelle</span>
          <span className="text-sm text-blue-600">{time.percent.toFixed(1)}%</span>
        </div>
        <div className="relative w-full h-3 bg-white rounded-full overflow-hidden" role="progressbar" aria-label="Progression temporelle" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(time.percent)}>
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
            style={{ width: `${progressBarWidth}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2 bg-white rounded-md p-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <div>
            <div className="text-xs text-gray-500">Temps écoulé</div>
            <div className="font-semibold text-gray-900">
              {Math.floor(time.elapsedWeeks)} semaine{time.elapsedWeeks > 1 ? 's' : ''} 
              {time.elapsedDays % 7 > 0 ? ` et ${time.elapsedDays % 7} jour${time.elapsedDays % 7 > 1 ? 's' : ''}` : ''} 
              <span className="text-xs text-gray-500 ml-1">/ {Math.ceil(time.totalWeeks)} sem.</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white rounded-md p-2">
          <TrendingUp className="w-4 h-4 text-gray-500" />
          <div>
            <div className="text-xs text-gray-500">Rythme cible</div>
            <div className="font-semibold text-gray-900">
              {Math.abs(progress.weekly_rate_target).toFixed(2)} kg/sem
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-blue-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Date de fin prévue :</span>
          <span className="font-semibold text-gray-900">{formatDateFR(end)}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-gray-600">Temps restant :</span>
          <span className="font-semibold text-blue-600">
            {time.percent >= 100 ? 'Terminé' : humanizeRemainingDays(now, end, start)}
          </span>
        </div>
      </div>
    </div>
  );
}
