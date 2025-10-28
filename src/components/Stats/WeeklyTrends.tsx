import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { calculateDailySummary } from '../../utils/calculations';

interface Entry {
  id: string;
  user_id: string;
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  food_name: string;
  serving_size_g: number;
  calories_kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
  created_at: string;
}

interface DailyTarget {
  id: string;
  user_id: string;
  date: string;
  calories_kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
  goal_id: string;
}

interface MacroSummary {
  calories_kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
}

interface DailySummary {
  date: string;
  consumed: MacroSummary;
  target: MacroSummary;
  status: 'under' | 'ok' | 'over';
}

type WeekDataItem = {
  date: string;
  summary: DailySummary | null;
}

export function WeeklyTrends() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [weekData, setWeekData] = useState<WeekDataItem[]>([]);

  useEffect(() => {
    if (user) {
      loadWeekData();
    }
  }, [user]);

  const loadWeekData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 6);

      const startDate = weekAgo.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];

      const [targetsResult, entriesResult] = await Promise.all([
        supabase
          .from('daily_targets')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date'),
        supabase
          .from('entries')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date'),
      ]);

      if (targetsResult.error) throw targetsResult.error;
      if (entriesResult.error) throw entriesResult.error;

      const targets = targetsResult.data || [];
      const entries = entriesResult.data || [];

      const data = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekAgo);
        date.setDate(weekAgo.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        const dayTarget = targets.find((t) => t.date === dateStr);
        const dayEntries = entries.filter((e) => e.date === dateStr);

        if (dayTarget) {
          const summary = calculateDailySummary(dayEntries, dayTarget, dateStr);
          data.push({ date: dateStr, summary });
        } else {
          data.push({ date: dateStr, summary: null });
        }
      }

      setWeekData(data);
    } catch (error) {
      console.error('Error loading week data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl text-gray-900 mb-4">Tendances 7 jours</h2>
        <div className="text-center py-8 text-gray-500">Chargement...</div>
      </div>
    );
  }

  const validDays = weekData.filter((d): d is WeekDataItem & { summary: DailySummary } => d.summary !== null);
  const avgCalories =
    validDays.length > 0
      ? Math.round(validDays.reduce((sum, d) => sum + d.summary.consumed.calories_kcal, 0) / validDays.length)
      : 0;
  const avgTarget =
    validDays.length > 0
      ? Math.round(validDays.reduce((sum, d) => sum + d.summary.target.calories_kcal, 0) / validDays.length)
      : 0;
  const avgDelta = avgCalories - avgTarget;

  const statusCount = {
    under: validDays.filter((d) => d.summary.status === 'under').length,
    ok: validDays.filter((d) => d.summary.status === 'ok').length,
    over: validDays.filter((d) => d.summary.status === 'over').length,
  };

  const maxCalories = Math.max(
    ...validDays.map((d) => Math.max(d.summary.consumed.calories_kcal, d.summary.target.calories_kcal)),
    2000
  );

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl text-gray-900">Tendances 7 jours</h2>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm text-blue-600 font-medium mb-1">Moyenne calories</div>
            <div className="text-2xl font-bold text-blue-900">{avgCalories}</div>
            <div className="text-xs text-blue-600 mt-1">Objectif : {avgTarget} kcal</div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 font-medium mb-1">Écart moyen</div>
            <div className="flex items-center gap-2">
              <div className={`text-2xl font-bold ${avgDelta < 0 ? 'text-orange-600' : avgDelta > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {avgDelta > 0 ? '+' : ''}{avgDelta}
              </div>
              {avgDelta < -50 && <TrendingDown className="w-5 h-5 text-orange-600" />}
              {avgDelta > 50 && <TrendingUp className="w-5 h-5 text-red-600" />}
              {Math.abs(avgDelta) <= 50 && <Minus className="w-5 h-5 text-green-600" />}
            </div>
            <div className="text-xs text-gray-600 mt-1">kcal/jour</div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm text-green-600 font-medium mb-1">Jours suivis</div>
            <div className="text-2xl font-bold text-green-900">{validDays.length}/7</div>
            <div className="text-xs text-green-600 mt-1">
              {statusCount.ok} jour{statusCount.ok > 1 ? 's' : ''} à l'objectif
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Graphique des calories</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="relative h-64">
              {/* Axe Y avec graduations */}
              <div className="absolute left-0 top-0 h-full w-16 flex flex-col justify-between text-xs text-gray-500 py-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center">
                    <span className="mr-2">{Math.round((maxCalories * (5 - i)) / 5)}</span>
                    <div className="flex-1 border-t border-gray-200" />
                  </div>
                ))}
              </div>

              <div className="absolute inset-0 flex items-end justify-between gap-2 pb-6 pl-16 pr-4">
                {weekData.map((day) => {
                  const height = day.summary
                    ? (day.summary.consumed.calories_kcal / maxCalories) * 100
                    : 0;
                  const targetHeight = day.summary
                    ? (day.summary.target.calories_kcal / maxCalories) * 100
                    : 0;

                  const getBarColor = (consumed: number, target: number) => {
                    if (!target) return 'bg-gray-300';
                    const percentage = (consumed / target) * 100;
                    if (percentage >= 95 && percentage <= 105) return 'bg-green-500'; // À l'objectif (±5%)
                    if (percentage < 95) {
                      if (percentage < 75) return 'bg-orange-600'; // Très en dessous
                      return 'bg-orange-400'; // En dessous
                    }
                    if (percentage > 105) {
                      if (percentage > 125) return 'bg-red-600'; // Très au-dessus
                      return 'bg-red-400'; // Au-dessus
                    }
                    return 'bg-gray-300';
                  };

                  const statusColor = day.summary
                    ? getBarColor(day.summary.consumed.calories_kcal, day.summary.target.calories_kcal)
                    : 'bg-gray-300';

                  const tooltipContent = day.summary
                    ? `Consommé: ${Math.round(day.summary.consumed.calories_kcal)} kcal\nObjectif: ${Math.round(day.summary.target.calories_kcal)} kcal`
                    : 'Pas de données';

                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1 relative group">
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-pre-line">
                        {tooltipContent}
                      </div>
                      <div className="w-full relative" style={{ height: 'calc(100% - 24px)' }}>
                        {/* Ligne de grille verticale */}
                        <div className="absolute inset-0 border-l border-gray-200" />
                        
                        {day.summary && (
                          <>
                            <div
                              className="absolute bottom-0 w-full border-t-2 border-dashed border-blue-400"
                              style={{ bottom: `${targetHeight}%` }}
                            />
                            <div
                              className={`absolute bottom-0 w-full ${statusColor} rounded-t transition-all duration-300 hover:opacity-80`}
                              style={{ height: `${height}%` }}
                            />
                          </>
                        )}
                        {!day.summary && (
                          <div className="absolute bottom-0 w-full h-2 bg-gray-200 rounded-t" />
                        )}
                      </div>
                      <div className="text-xs text-gray-600 font-medium capitalize">
                        {new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'short' })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-center gap-6 mt-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded" />
                <span className="text-gray-600">À l'objectif</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-400 rounded" />
                <span className="text-gray-600">En dessous</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded" />
                <span className="text-gray-600">Au-dessus</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 border-t-2 border-dashed border-blue-400" />
                <span className="text-gray-600">Objectif</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Historique détaillé</h3>
          <div className="space-y-2">
            {weekData.map((day) => {
              const date = new Date(day.date);
              const dayName = date.toLocaleDateString('fr-FR', { weekday: 'short' });
              const dateStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

              if (!day.summary) {
                return (
                  <div key={day.date} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <div className="flex items-center gap-3">
                      <div className="w-16 text-sm font-medium text-gray-600 capitalize">{dayName}</div>
                      <div className="text-xs text-gray-500">{dateStr}</div>
                    </div>
                    <div className="text-sm text-gray-400">Pas de données</div>
                  </div>
                );
              }

              const statusConfig: Record<'under' | 'ok' | 'over', { bg: string; text: string; label: string }> = {
                under: { bg: 'bg-orange-50', text: 'text-orange-600', label: 'Sous' },
                ok: { bg: 'bg-green-50', text: 'text-green-600', label: 'OK' },
                over: { bg: 'bg-red-50', text: 'text-red-600', label: 'Au-dessus' },
              };

              const config = statusConfig[day.summary.status];

              return (
                <div key={day.date} className={`flex items-center justify-between p-3 ${config.bg} rounded-md`}>
                  <div className="flex items-center gap-3">
                    <div className="w-16 text-sm font-medium text-gray-900 capitalize">{dayName}</div>
                    <div className="text-xs text-gray-600">{dateStr}</div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-700">
                      <span className="font-semibold">{Math.round(day.summary.consumed.calories_kcal)}</span>
                      <span className="text-gray-500"> / {Math.round(day.summary.target.calories_kcal)} kcal</span>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${config.text}`}>
                      {config.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
