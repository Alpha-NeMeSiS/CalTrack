// Tendances : graphique des calories sur 7 jours et historique détaillé sur 30 jours
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/useAuth';
import { calculateDailySummary } from '../../utils/calculations';
import { addDaysToDateString, getTodayDate, parseLocalDate } from '../../utils/date';
import {
  DayStatus,
  DAY_STATUS_LABELS,
  getBarColorClass,
  getCalorieAxisTicks,
  getDayStatus,
} from '../../utils/dayStatus';

// Interface pour le résumé des macronutriments
interface MacroSummary {
  calories_kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g?: number;
}

// Interface pour le résumé quotidien
interface DailySummary {
  date: string;
  consumed: MacroSummary; // Macronutriments consommés
  target: MacroSummary; // Objectifs de macronutriments
  status: 'under' | 'ok' | 'over'; // Statut par rapport à l'objectif
}

// Données d'une journée
type DayItem = {
  date: string;
  summary: DailySummary | null; // null si aucun objectif ce jour-là
  dayStatus: DayStatus | null; // statut d'affichage (null si aucun objectif)
};

// Hauteur utilisable du graphique (barres, graduations et grille partagent cette échelle)
const CHART_HEIGHT_PX = 200;

// Styles des lignes de l'historique selon le statut
const ROW_STYLES: Record<DayStatus, { bg: string; text: string }> = {
  not_logged: { bg: 'bg-gray-50', text: 'text-gray-500' },
  in_progress: { bg: 'bg-blue-50', text: 'text-blue-700' },
  under: { bg: 'bg-orange-50', text: 'text-orange-600' },
  ok: { bg: 'bg-green-50', text: 'text-green-600' },
  over: { bg: 'bg-red-50', text: 'text-red-600' },
};

// Légende du graphique
const LEGEND: Array<{ label: string; swatch: string }> = [
  { label: DAY_STATUS_LABELS.ok, swatch: 'bg-green-500' },
  { label: DAY_STATUS_LABELS.under, swatch: 'bg-orange-400' },
  { label: DAY_STATUS_LABELS.over, swatch: 'bg-red-500' },
  { label: DAY_STATUS_LABELS.in_progress, swatch: 'bg-blue-400' },
  { label: DAY_STATUS_LABELS.not_logged, swatch: 'bg-gray-200' },
];

// Composant principal pour afficher les tendances hebdomadaires
export function WeeklyTrends() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [weekData, setWeekData] = useState<DayItem[]>([]); // 7 derniers jours
  const [monthData, setMonthData] = useState<DayItem[]>([]); // 30 derniers jours

  // Charge les cibles et les entrées des 30 derniers jours
  const loadWeekData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setLoadError(null);
    try {
      // Dates locales (et non UTC) pour la période d'analyse
      const endDate = getTodayDate();
      const startDate = addDaysToDateString(endDate, -30);

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

      const buildDay = (dateStr: string): DayItem => {
        const dayTarget = targets.find((t) => t.date === dateStr);
        if (!dayTarget) {
          return { date: dateStr, summary: null, dayStatus: null };
        }
        const dayEntries = entries.filter((e) => e.date === dateStr);
        const summary = calculateDailySummary(dayEntries, dayTarget, dateStr);
        return {
          date: dateStr,
          summary,
          dayStatus: getDayStatus({
            status: summary.status,
            entryCount: dayEntries.length,
            isToday: dateStr === endDate,
          }),
        };
      };

      // 7 derniers jours (du plus ancien au plus récent) et 30 derniers (du plus récent)
      setWeekData([6, 5, 4, 3, 2, 1, 0].map((i) => buildDay(addDaysToDateString(endDate, -i))));
      setMonthData(Array.from({ length: 30 }, (_, i) => buildDay(addDaysToDateString(endDate, -i))));
    } catch (error) {
      console.error('Error loading week data:', error);
      setLoadError("Impossible de charger l'historique.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadWeekData();
    }
  }, [loadWeekData, user]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl text-gray-900 mb-4">Tendances 7 jours</h2>
        <div className="text-center py-8 text-gray-500">Chargement...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl text-gray-900 mb-4">Tendances et historique</h2>
        <div role="alert" className="text-center py-8">
          <p className="text-red-700 mb-4">{loadError}</p>
          <button type="button" onClick={() => loadWeekData()} className="btn-kaizen">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // Échelle du graphique : les journées non renseignées ne comptent pas
  const maxCalories = Math.max(
    0,
    ...weekData
      .filter((d) => d.summary)
      .map((d) => Math.max(d.summary!.consumed.calories_kcal, d.summary!.target.calories_kcal))
  );
  const ticks = getCalorieAxisTicks(maxCalories);
  const axisMax = ticks[ticks.length - 1];
  const toPx = (value: number) => Math.round((Math.max(0, value) / axisMax) * CHART_HEIGHT_PX);

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="p-4 sm:p-6 border-b border-gray-200">
        <h2 className="text-xl text-gray-900">Tendances et historique</h2>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        <div>
          <h3 className="text-sm text-gray-900 mb-4">Graphique des calories</h3>
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
            <div className="flex gap-2" role="img" aria-label="Calories consommées et objectif sur les 7 derniers jours">
              {/* Axe Y : graduations positionnées sur la même échelle que les barres */}
              <div className="relative w-10 shrink-0" style={{ height: CHART_HEIGHT_PX }} aria-hidden="true">
                {ticks.map((tick) => (
                  <span
                    key={tick}
                    className="absolute right-0 translate-y-1/2 text-[11px] leading-none text-gray-500"
                    style={{ bottom: toPx(tick) }}
                  >
                    {tick}
                  </span>
                ))}
              </div>

              {/* Zone des barres avec lignes de grille */}
              <div className="relative flex-1" style={{ height: CHART_HEIGHT_PX }}>
                {ticks.map((tick) => (
                  <div
                    key={tick}
                    className="absolute inset-x-0 border-t border-gray-200"
                    style={{ bottom: toPx(tick) }}
                    aria-hidden="true"
                  />
                ))}

                <div className="absolute inset-0 flex items-end gap-1.5 sm:gap-2">
                  {weekData.map((day) => {
                    const consumed = day.summary?.consumed.calories_kcal ?? 0;
                    const target = day.summary?.target.calories_kcal ?? 0;
                    const status = day.dayStatus;
                    const hasBar = day.summary && status !== 'not_logged';
                    const label = status ? DAY_STATUS_LABELS[status] : 'Pas d’objectif';
                    const tooltip = day.summary
                      ? `${label} — ${Math.round(consumed)} / ${Math.round(target)} kcal`
                      : label;

                    return (
                      <div key={day.date} className="relative flex h-full flex-1 items-end justify-center group" title={tooltip}>
                        {day.summary && (
                          <div
                            className="absolute inset-x-0 border-t-2 border-dashed border-blue-400"
                            style={{ bottom: toPx(target) }}
                            aria-hidden="true"
                          />
                        )}
                        {hasBar ? (
                          <div
                            className={`relative w-full rounded-t transition-all duration-300 ${getBarColorClass(status!, consumed, target)}`}
                            style={{ height: Math.max(4, toPx(consumed)) }}
                          />
                        ) : (
                          // Journée non renseignée (ou sans objectif) : simple repère gris
                          <div className="w-full h-1 rounded-t bg-gray-200" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Jours de la semaine, alignés sur les barres */}
            <div className="flex gap-1.5 sm:gap-2 mt-1 pl-12">
              {weekData.map((day) => (
                <div key={day.date} className="flex-1 text-center text-xs text-gray-600 font-medium capitalize">
                  {parseLocalDate(day.date).toLocaleDateString('fr-FR', { weekday: 'short' })}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-4 text-xs">
              {LEGEND.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded ${item.swatch}`} />
                  <span className="text-gray-600">{item.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <div className="w-6 border-t-2 border-dashed border-blue-400" />
                <span className="text-gray-600">Objectif</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm text-gray-900 mb-3">Historique détaillé (30 jours)</h3>
          <div className="space-y-2 h-[400px] overflow-y-auto pr-2 scrollbar scrollbar-thin scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400 scrollbar-track-transparent">
            {monthData.map((day) => {
              const date = parseLocalDate(day.date);
              const dayName = date.toLocaleDateString('fr-FR', { weekday: 'short' });
              const dateStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

              if (!day.summary || !day.dayStatus) {
                return (
                  <div key={day.date} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <div className="flex items-center gap-3">
                      <div className="w-12 text-sm font-medium text-gray-600 capitalize">{dayName}</div>
                      <div className="text-xs text-gray-500">{dateStr}</div>
                    </div>
                    <div className="text-sm text-gray-400">Pas d’objectif</div>
                  </div>
                );
              }

              const style = ROW_STYLES[day.dayStatus];
              const statusLabel = DAY_STATUS_LABELS[day.dayStatus];

              if (day.dayStatus === 'not_logged') {
                return (
                  <div key={day.date} className={`flex items-center justify-between p-3 ${style.bg} rounded-md`}>
                    <div className="flex items-center gap-3">
                      <div className="w-12 text-sm font-medium text-gray-600 capitalize">{dayName}</div>
                      <div className="text-xs text-gray-500">{dateStr}</div>
                    </div>
                    <div className={`text-sm ${style.text}`}>
                      {statusLabel}
                      <span className="text-gray-400"> · objectif {Math.round(day.summary.target.calories_kcal)} kcal</span>
                    </div>
                  </div>
                );
              }

              return (
                <div key={day.date} className={`flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3 p-3 ${style.bg} rounded-md`}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 text-sm font-medium text-gray-900 capitalize">{dayName}</div>
                    <div className="text-xs text-gray-600">{dateStr}</div>
                  </div>

                  <div className="flex items-start justify-between gap-3 sm:justify-end sm:gap-4">
                    <div className="text-sm text-gray-700">
                      <div className="flex items-baseline gap-1">
                        <span className="font-semibold">{Math.round(day.summary.consumed.calories_kcal)}</span>
                        <span className="text-gray-500"> / {Math.round(day.summary.target.calories_kcal)} kcal</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
                        <div>P: <span className="font-semibold">{Math.round(day.summary.consumed.protein_g)} g</span> / {Math.round(day.summary.target.protein_g)} g</div>
                        <div>L: <span className="font-semibold">{Math.round(day.summary.consumed.fat_g)} g</span> / {Math.round(day.summary.target.fat_g)} g</div>
                        <div>G: <span className="font-semibold">{Math.round(day.summary.consumed.carbs_g)} g</span> / {Math.round(day.summary.target.carbs_g)} g</div>
                        <div>F: <span className="font-semibold">{Math.round(day.summary.consumed.fiber_g || 0)} g</span> / {Math.round(day.summary.target.fiber_g || 0)} g</div>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${style.text}`}>
                      {statusLabel}
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
