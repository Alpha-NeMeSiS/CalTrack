import { Target, Calendar, TrendingUp } from 'lucide-react';
import { Goal } from '../../lib/supabase';
import { calculateGoalProgress } from '../../utils/calculations';

interface GoalProgressCardProps {
  goal: Goal;
  currentWeight: number;
}

export function GoalProgressCard({ goal, currentWeight }: GoalProgressCardProps) {
  if (!goal.target_weight_kg || !goal.duration_weeks || !goal.start_date) {
    return null;
  }

  const progress = calculateGoalProgress(
    currentWeight,
    goal.target_weight_kg,
    goal.duration_weeks,
    goal.start_date,
    goal.type as 'loss' | 'gain'
  );

  const progressBarWidth = Math.min(progress.progress_pct, 100);

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
          <div className="text-xs text-gray-600 mb-1">Changement cible</div>
          <div className="text-2xl font-bold text-gray-900">
            {progress.weight_change > 0 ? '+' : ''}
            {progress.weight_change.toFixed(1)} kg
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Progression temporelle</span>
          <span className="text-sm text-blue-600">{progress.progress_pct.toFixed(1)}%</span>
        </div>
        <div className="relative w-full h-3 bg-white rounded-full overflow-hidden">
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
              {progress.weeks_elapsed} / {progress.weeks_total} semaines
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
          <span className="font-semibold text-gray-900">
            {new Date(progress.estimated_end_date).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-gray-600">Temps restant :</span>
          <span className="font-semibold text-blue-600">
            {progress.weeks_remaining} semaine{progress.weeks_remaining > 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
